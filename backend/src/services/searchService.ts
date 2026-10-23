import mongoose from 'mongoose';
import Product, { IProduct } from '../models/Product';
import Order from '../models/Order';
import { AppError } from '../middleware/errorHandler';

/**
 * Search & Recommendations Service
 * =================================
 * Backs the typeahead autocomplete dropdown and the "customers also bought" /
 * "related products" modules on the storefront.
 *
 * Production caching note:
 *   Both `getAutocomplete` and `getRecommendations` are read-heavy and shift slowly,
 *   so they're prime candidates for Redis. Suggested keys:
 *     - autocomplete:  `ac:{query}`        TTL 60s
 *     - recommendations: `rec:{productId}`  TTL 5–15 min
 *   Co-occurrence especially benefits because the aggregation scans the orders
 *   collection. Cache invalidation hooks: product update/delete, order paid event.
 */

export interface AutocompleteSuggestion {
  _id: string;
  name: string;
  slug: string;
  category: string;
  price: number;
  image: string;
}

export interface PopularTerm {
  _id: string;
  name: string;
  slug: string;
}

export interface Recommendation {
  _id: string;
  name: string;
  slug: string;
  price: number;
  image: string;
  rating: number;
  count: number;
}

export interface RelatedProduct {
  _id: string;
  name: string;
  slug: string;
  price: number;
  image: string;
  rating: number;
}

// Hard caps so a misbehaving client can't ask for thousands of rows
const AUTOCOMPLETE_MAX = 8;
const POPULAR_MAX = 10;
const RECOMMENDATION_MAX = 10;

// Strip regex metacharacters from user input to prevent regex injection
// (e.g. `.*` or `(?=...)` in a query string).
const escapeRegex = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const objectIdToString = (doc: { _id: unknown }): string =>
  (doc._id as mongoose.Types.ObjectId).toString();

export class SearchService {
  /**
   * Autocomplete — prefix-first then contains-fallback.
   *
   * Why two passes? Users typing in a search box expect prefix matches ("phone" →
   * "iPhone Case" should NOT appear before "Phone Stand"). So we run a prefix
   * regex first, sorted by rating. Only if that returns fewer than `limit` do we
   * backfill with contains matches.
   *
   * Active products only (isActive: true). Soft-deleted products are filtered out
   * by the Product schema's pre-find hook.
   */
  async getAutocomplete(rawQuery: string, limit: number = AUTOCOMPLETE_MAX): Promise<AutocompleteSuggestion[]> {
    const query = (rawQuery || '').trim();
    if (query.length < 2) return [];

    const cap = Math.min(Math.max(limit, 1), AUTOCOMPLETE_MAX);
    const escaped = escapeRegex(query);
    const prefixRegex = new RegExp(`^${escaped}`, 'i');
    const containsRegex = new RegExp(escaped, 'i');

    const projection = { _id: 1, name: 1, slug: 1, category: 1, price: 1, images: 1 };

    const prefixHits = await Product.find({
      isActive: true,
      name: prefixRegex
    })
      .select(projection)
      .sort({ rating: -1, name: 1 })
      .limit(cap);

    if (prefixHits.length >= cap) {
      return prefixHits.map(this.toSuggestion);
    }

    // Backfill with contains matches, excluding already-found docs
    const excludeIds = prefixHits.map(p => p._id);
    const remaining = cap - prefixHits.length;
    const containsFilter: mongoose.FilterQuery<IProduct> = {
      isActive: true,
      name: containsRegex
    };
    if (excludeIds.length > 0) {
      containsFilter._id = { $nin: excludeIds };
    }

    const containsHits = await Product.find(containsFilter)
      .select(projection)
      .sort({ rating: -1, name: 1 })
      .limit(remaining);

    return [...prefixHits, ...containsHits].map(this.toSuggestion);
  }

  private toSuggestion(p: IProduct): AutocompleteSuggestion {
    return {
      _id: objectIdToString(p),
      name: p.name,
      slug: p.slug,
      category: p.category,
      price: p.price,
      image: p.images?.[0] ?? ''
    };
  }

  /**
   * Popular search terms.
   *
   * No search-term tracking collection exists yet, so as a reasonable proxy we
   * surface the top product names by review count then rating — these are the
   * products a typeahead dropdown would most usefully suggest when the user
   * hasn't typed anything yet.
   *
   * When search-event logging is added, swap this for an aggregation over the
   * search-terms collection (`$group` by term, `$sort` by count desc).
   */
  async getPopular(limit: number = POPULAR_MAX): Promise<PopularTerm[]> {
    const cap = Math.min(Math.max(limit, 1), POPULAR_MAX);
    const products = await Product.find({ isActive: true })
      .select({ _id: 1, name: 1, slug: 1, numReviews: 1, rating: 1 })
      .sort({ numReviews: -1, rating: -1 })
      .limit(cap);

    return products.map(p => ({
      _id: objectIdToString(p),
      name: p.name,
      slug: p.slug
    }));
  }

  /**
   * "Customers also bought" — order co-occurrence recommendations.
   *
   * Pipeline:
   *   1. $match  paid orders containing the source product
   *   2. $unwind orderItems so each item becomes its own doc
   *   3. $match  exclude the source product itself
   *   4. $group  by sibling product id, counting how many orders contained both
   *   5. $sort   by co-occurrence count desc
   *   6. $limit  cap
   *   7. $lookup product details (so we can return name/price/image)
   *   8. $match  filter out inactive / soft-deleted products (the aggregation
   *              bypasses Mongoose middleware, so we filter explicitly)
   *   9. $project the response shape
   *
   * Fallback: if no co-occurrence data (e.g. a brand-new product), return
   * top-rated products from the same category. If the source product itself
   * doesn't exist, return an empty array — the storefront would 404 on the
   * detail page anyway.
   */
  async getRecommendations(productId: string, limit: number = 5): Promise<Recommendation[]> {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new AppError('Invalid product id', 400);
    }

    const cap = Math.min(Math.max(limit, 1), RECOMMENDATION_MAX);
    const oid = new mongoose.Types.ObjectId(productId);

    const pipeline: mongoose.PipelineStage[] = [
      { $match: { 'orderItems.product': oid, isPaid: true } },
      { $unwind: '$orderItems' },
      { $match: { 'orderItems.product': { $ne: oid } } },
      {
        $group: {
          _id: '$orderItems.product',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: cap },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      // aggregations skip Mongoose middleware — filter soft-deleted / inactive manually
      { $match: { 'product.isActive': true, 'product.deletedAt': null } },
      {
        $project: {
          _id: '$product._id',
          name: '$product.name',
          slug: '$product.slug',
          price: '$product.price',
          image: { $arrayElemAt: ['$product.images', 0] },
          rating: '$product.rating',
          count: '$count'
        }
      }
    ];

    const results = (await Order.aggregate(pipeline)) as Recommendation[];
    if (results.length > 0) {
      return results;
    }

    // Fallback: same category, top-rated, excluding the source product
    const source = await Product.findById(oid).select({ category: 1 });
    if (!source) {
      // Source product doesn't exist — no co-occurrence, no category to fall back on.
      return [];
    }

    const fallback = await Product.find({
      _id: { $ne: oid },
      isActive: true,
      category: source.category
    })
      .select({ _id: 1, name: 1, slug: 1, price: 1, images: 1, rating: 1 })
      .sort({ rating: -1, numReviews: -1 })
      .limit(cap);

    return fallback.map(p => ({
      _id: objectIdToString(p),
      name: p.name,
      slug: p.slug,
      price: p.price,
      image: p.images?.[0] ?? '',
      rating: p.rating,
      count: 0
    }));
  }

  /**
   * Related products — same category as the source, excluding the source itself,
   * sorted by rating. Used for the "you might also like" rail on a PDP.
   *
   * Returns 404 if the source product doesn't exist (we can't determine category).
   */
  async getRelated(productId: string, limit: number = 5): Promise<RelatedProduct[]> {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new AppError('Invalid product id', 400);
    }

    const cap = Math.min(Math.max(limit, 1), RECOMMENDATION_MAX);
    const oid = new mongoose.Types.ObjectId(productId);

    const source = await Product.findById(oid).select({ category: 1 });
    if (!source) {
      throw new AppError('Product not found', 404);
    }

    const related = await Product.find({
      _id: { $ne: oid },
      isActive: true,
      category: source.category
    })
      .select({ _id: 1, name: 1, slug: 1, price: 1, images: 1, rating: 1 })
      .sort({ rating: -1, numReviews: -1 })
      .limit(cap);

    return related.map(p => ({
      _id: objectIdToString(p),
      name: p.name,
      slug: p.slug,
      price: p.price,
      image: p.images?.[0] ?? '',
      rating: p.rating
    }));
  }
}

export default new SearchService();

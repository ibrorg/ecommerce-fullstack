import { Client as TypesenseClient } from 'typesense';
import Product from '../models/Product';
import logger from '../utils/logger';

/**
 * TypesenseService — semantic / typo-tolerant search backend.
 *
 * Provides:
 *  - `isEnabled()` — checks whether Typesense is configured + reachable.
 *  - `ensureCollection()` — creates the `products` collection (idempotent).
 *  - `upsertProduct(id)` / `deleteDocument(id)` — index sync.
 *  - `search(query, opts)` — full-text search with facets + filters.
 *
 * Fail-open: if TYPESENSE_URL is unset or the server is unreachable, every
 * method returns gracefully. The search route falls back to the existing
 * MongoDB text search in that case (see searchController).
 */

const COLLECTION_NAME = 'products';

let client: TypesenseClient | null = null;
let enabledChecked = false;
let cachedEnabled = false;

function getClient(): TypesenseClient | null {
  if (client) return client;
  const url = process.env.TYPESENSE_URL;
  const apiKey = process.env.TYPESENSE_API_KEY;
  if (!url || !apiKey) return null;

  try {
    // Typesense URL is like http://host:8108 — parse for the Node client.
    const parsed = new URL(url);
    client = new TypesenseClient({
      nodes: [
        {
          host: parsed.hostname,
          port: Number(parsed.port) || 8108,
          protocol: parsed.protocol.replace(':', ''),
        },
      ],
      apiKey,
      connectionTimeoutSeconds: 5,
    });
    return client;
  } catch {
    return null;
  }
}

// Schema for the products collection. Typed loosely because the strict
// CollectionSchema type includes response-only fields (created_at, etc.).
const schema: any = {
  name: COLLECTION_NAME,
  fields: [
    { name: 'name', type: 'string', facet: false },
    { name: 'description', type: 'string', facet: false },
    { name: 'category', type: 'string', facet: true },
    { name: 'brand', type: 'string', facet: true, optional: true },
    { name: 'price', type: 'float', facet: false },
    { name: 'rating', type: 'float', facet: false },
    { name: 'numReviews', type: 'int32', facet: false },
    { name: 'isActive', type: 'bool', facet: false },
    { name: 'slug', type: 'string', facet: false },
    { name: 'image', type: 'string', facet: false, optional: true },
    { name: 'tags', type: 'string[]', facet: true, optional: true },
  ],
  default_sorting_field: 'rating',
};

export const TypesenseService = {
  async isEnabled(): Promise<boolean> {
    if (enabledChecked) return cachedEnabled;
    enabledChecked = true;
    const c = getClient();
    if (!c) return false;
    try {
      await c.health.retrieve();
      cachedEnabled = true;
      return true;
    } catch (err) {
      logger.warn({ msg: 'Typesense not reachable — search falls back to MongoDB', error: (err as Error).message });
      return false;
    }
  },

  async ensureCollection(): Promise<void> {
    const c = getClient();
    if (!c) return;
    try {
      await c.collections(COLLECTION_NAME).retrieve();
    } catch {
      // Collection doesn't exist — create it.
      await c.collections().create(schema);
      logger.info({ msg: 'Typesense collection created', name: COLLECTION_NAME });
    }
  },

  async upsertProduct(productId: string): Promise<void> {
    const c = getClient();
    if (!c) return;
    const product = await Product.findById(productId).lean();
    if (!product) return;

    await c.collections(COLLECTION_NAME).documents().upsert({
      id: String(product._id),
      name: product.name,
      description: product.description || '',
      category: product.category || '',
      brand: product.brand || '',
      price: Number(product.price) || 0,
      rating: Number(product.rating) || 0,
      numReviews: Number(product.numReviews) || 0,
      isActive: product.isActive !== false,
      slug: product.slug || '',
      image: product.images?.[0] || '',
      tags: product.tags || [],
    });
  },

  async deleteDocument(productId: string): Promise<void> {
    const c = getClient();
    if (!c) return;
    try {
      await c.collections(COLLECTION_NAME).documents(productId).delete();
    } catch (err) {
      // Document may not exist (e.g. never indexed) — that's fine.
      logger.debug({ msg: 'Typesense delete skipped', productId, error: (err as Error).message });
    }
  },

  async search(
    query: string,
    opts: {
      page?: number;
      perPage?: number;
      filterBy?: string;
      sortBy?: string;
    } = {},
  ): Promise<{
    hits: Array<{
      id: string;
      name: string;
      slug: string;
      category: string;
      price: number;
      rating: number;
      image: string;
      textScore?: number;
    }>;
    found: number;
    page: number;
  }> {
    const c = getClient();
    if (!c) {
      return { hits: [], found: 0, page: opts.page || 1 };
    }

    const results = await c.collections(COLLECTION_NAME).documents().search({
      q: query,
      query_by: 'name,description,brand,tags,category',
      filter_by: opts.filterBy || 'isActive:=true',
      sort_by: opts.sortBy || '_text_match:desc,rating:desc',
      page: opts.page || 1,
      per_page: opts.perPage || 20,
      facet_by: 'category,brand',
    });

    const hits = (results.hits || []).map((hit) => {
      const doc = hit.document as any;
      return {
        id: doc.id,
        name: doc.name,
        slug: doc.slug,
        category: doc.category,
        price: doc.price,
        rating: doc.rating,
        image: doc.image || '',
        textScore: hit.text_match,
      };
    });

    return {
      hits,
      found: (results as any).found || hits.length,
      page: (results as any).page || 1,
    };
  },

  /** Bulk reindex — call from a migration / admin endpoint. */
  async reindexAll(): Promise<number> {
    const c = getClient();
    if (!c) return 0;
    await this.ensureCollection();

    const products = await Product.find({ isActive: true }).lean();
    let count = 0;
    for (const product of products) {
      try {
        await this.upsertProduct(String(product._id));
        count++;
      } catch (err) {
        logger.error({ msg: 'Reindex failed for product', id: product._id, error: (err as Error).message });
      }
    }
    logger.info({ msg: 'Typesense reindex complete', indexed: count, total: products.length });
    return count;
  },
};

export default TypesenseService;

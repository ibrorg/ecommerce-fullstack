import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import Product from '../models/Product';
import logger from '../utils/logger';

/**
 * RecommendationService — vector-based "similar products" via OpenAI
 * embeddings + Qdrant.
 *
 * Flow:
 *  1. On product create/update, generate an embedding from
 *     `${name} — ${description} — ${category} ${tags}` via OpenAI's
 *     `text-embedding-3-small` (1536 dims, cheap).
 *  2. Upsert the vector + payload into the Qdrant `products` collection.
 *  3. On a "similar to X" request, fetch X's vector and run a Qdrant
 *     similarity search; return the nearest products (excluding X).
 *
 * Fail-open: if OPENAI_API_KEY or QDRANT_URL is unset, or either service is
 * unreachable, `isEnabled()` returns false and callers fall back to the
 * existing category-based recommendations (see SearchService.getRelated).
 */

const COLLECTION = 'products';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;

let qdrant: QdrantClient | null = null;
let openai: OpenAI | null = null;
let enabledChecked = false;
let cachedEnabled = false;

function getQdrant(): QdrantClient | null {
  if (qdrant) return qdrant;
  const url = process.env.QDRANT_URL;
  if (!url) return null;
  try {
    qdrant = new QdrantClient({ url, timeout: 10000, checkCompatibility: false });
    return qdrant;
  } catch {
    return null;
  }
}

function getOpenAI(): OpenAI | null {
  if (openai) return openai;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  openai = new OpenAI({ apiKey: key });
  return openai;
}

async function embed(text: string): Promise<number[] | null> {
  const client = getOpenAI();
  if (!client) return null;
  try {
    const res = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000),
    });
    return res.data[0].embedding;
  } catch (err) {
    logger.error({ msg: 'OpenAI embedding failed', error: (err as Error).message });
    return null;
  }
}

/** Build the text fed to the embedding model. */
function buildEmbeddingText(p: any): string {
  return [p.name, p.description, p.category, p.brand, (p.tags || []).join(' ')]
    .filter(Boolean)
    .join(' — ');
}

/**
 * Qdrant point IDs must be UUID strings or unsigned integers. We use a
 * deterministic UUID v5-like derivation from the MongoDB ObjectId hex
 * string so re-indexing the same product updates the same point.
 */
function toUuidLike(hex: string): string {
  const padded = (hex + '000000000000000000000000').slice(0, 32);
  return (
    padded.slice(0, 8) +
    '-' +
    padded.slice(8, 12) +
    '-' +
    padded.slice(12, 16) +
    '-' +
    padded.slice(16, 20) +
    '-' +
    padded.slice(20, 32)
  );
}

export const RecommendationService = {
  async isEnabled(): Promise<boolean> {
    if (enabledChecked) return cachedEnabled;
    enabledChecked = true;
    if (!getOpenAI() || !getQdrant()) return false;
    try {
      await getQdrant()!.getCollections();
      cachedEnabled = true;
      return true;
    } catch (err) {
      logger.warn({ msg: 'Qdrant not reachable — recommendations fall back to category match', error: (err as Error).message });
      return false;
    }
  },

  async ensureCollection(): Promise<void> {
    const c = getQdrant();
    if (!c) return;
    try {
      await c.getCollection(COLLECTION);
    } catch {
      await c.createCollection(COLLECTION, {
        vectors: { size: EMBEDDING_DIM, distance: 'Cosine' },
      });
      logger.info({ msg: 'Qdrant collection created', name: COLLECTION });
    }
  },

  async indexProduct(productId: string): Promise<void> {
    const c = getQdrant();
    if (!c) return;
    const product = await Product.findById(productId).lean();
    if (!product) return;

    const vector = await embed(buildEmbeddingText(product));
    if (!vector) return;

    await this.ensureCollection();
    await c.upsert(COLLECTION, {
      wait: true,
      points: [
        {
          id: toUuidLike(String(product._id)),
          vector,
          payload: {
            productId: String(product._id),
            name: product.name,
            slug: product.slug,
            category: product.category,
            price: Number(product.price),
            rating: Number(product.rating),
            image: product.images?.[0] || '',
            isActive: product.isActive !== false,
          },
        },
      ],
    });
  },

  async deleteProduct(productId: string): Promise<void> {
    const c = getQdrant();
    if (!c) return;
    try {
      await c.delete(COLLECTION, {
        wait: true,
        points: [toUuidLike(productId)],
      });
    } catch (err) {
      logger.debug({ msg: 'Qdrant delete skipped', productId, error: (err as Error).message });
    }
  },

  async getSimilar(
    productId: string,
    limit = 6,
  ): Promise<
    Array<{
      productId: string;
      name: string;
      slug: string;
      category: string;
      price: number;
      rating: number;
      image: string;
      score: number;
    }>
  > {
    const c = getQdrant();
    if (!c) return [];

    // Fetch the source product's vector, then run a nearest-neighbour query.
    const source = await c.retrieve(COLLECTION, {
      ids: [toUuidLike(productId)],
      with_vector: true,
    });
    if (!source || source.length === 0 || !source[0].vector) return [];

    // Qdrant's `query` endpoint (the `search` method was removed in newer
    // client versions) — we pass the source vector as the `query` field.
    const results = await c.query(COLLECTION, {
      query: source[0].vector as number[],
      using: 'default',
      limit: limit + 1,
      with_payload: true,
      filter: {
        must: [
          { key: 'isActive', match: { value: true } },
          { key: 'productId', match: { except: [productId] } },
        ],
      },
    });

    const points = (results as any).points || [];
    return points.slice(0, limit).map((r: any) => ({
      productId: r.payload?.productId || '',
      name: r.payload?.name || '',
      slug: r.payload?.slug || '',
      category: r.payload?.category || '',
      price: Number(r.payload?.price) || 0,
      rating: Number(r.payload?.rating) || 0,
      image: r.payload?.image || '',
      score: r.score || 0,
    }));
  },

  /** Bulk reindex — call from an admin endpoint or migration. */
  async reindexAll(): Promise<number> {
    if (!(await this.isEnabled())) return 0;
    await this.ensureCollection();

    const products = await Product.find({ isActive: true }).lean();
    let count = 0;
    for (const product of products) {
      try {
        await this.indexProduct(String(product._id));
        count++;
      } catch (err) {
        logger.error({ msg: 'Embedding reindex failed', id: product._id, error: (err as Error).message });
      }
    }
    logger.info({ msg: 'Qdrant reindex complete', indexed: count, total: products.length });
    return count;
  },
};

export default RecommendationService;

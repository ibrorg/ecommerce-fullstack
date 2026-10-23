import logger from '../../utils/logger';

/**
 * Embedding generation job — computes a product's embedding via OpenAI and
 * upserts it into Qdrant for similar-product recommendations.
 *
 * Triggered when a product is created or its name/description changes.
 * If OpenAI or Qdrant is unavailable, the job logs and exits (the existing
 * category-based fallback recommendations still serve results).
 */
export async function runEmbeddingGeneration(data: { productId: string }): Promise<void> {
  if (!data?.productId) {
    logger.warn({ msg: '[job] Embedding skipped — missing productId' });
    return;
  }

  const { default: recommendationService } = await import('../../services/recommendationService');
  const enabled = await recommendationService.isEnabled();
  if (!enabled) return;

  await recommendationService.indexProduct(data.productId);
  logger.info({ msg: '[job] Embedding generated + indexed', productId: data.productId });
}

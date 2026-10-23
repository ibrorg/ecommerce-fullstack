import logger from '../../utils/logger';

/**
 * Search index job — pushes a product document to Typesense.
 *
 * Payload is the product id + the op (create / update / delete). The job
 * handler calls the Typesense service to sync the index. If Typesense is
 * unavailable, the job logs and exits (the MongoDB fallback search still
 * serves results).
 */
export async function runSearchIndex(data: {
  productId: string;
  op: 'create' | 'update' | 'delete';
}): Promise<void> {
  if (!data?.productId) {
    logger.warn({ msg: '[job] Search index skipped — missing productId' });
    return;
  }

  const { default: typesenseService } = await import('../../services/typesenseService');
  const enabled = await typesenseService.isEnabled();
  if (!enabled) return;

  if (data.op === 'delete') {
    await typesenseService.deleteDocument(data.productId);
  } else {
    await typesenseService.upsertProduct(data.productId);
  }
  logger.info({ msg: '[job] Search index synced', productId: data.productId, op: data.op });
}

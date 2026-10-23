import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import TypesenseService from '../services/typesenseService';
import RecommendationService from '../services/recommendationService';
import { isQueueEnabled } from '../queue/workers';

const router = express.Router();

/**
 * Admin infra routes — reindex search/recommendations backends + health.
 *
 *   GET  /api/admin/infra/health            — status of each backend
 *   POST /api/admin/infra/reindex/search    — bulk reindex Typesense
 *   POST /api/admin/infra/reindex/embeddings — bulk reindex Qdrant (AI)
 */

router.use(authenticate, requireAdmin);

router.get(
  '/infra/health',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const [typesense, qdrant] = await Promise.all([
      TypesenseService.isEnabled(),
      RecommendationService.isEnabled(),
    ]);
    return sendSuccess(res, 200, {
      queue: { enabled: isQueueEnabled() },
      typesense: { enabled: typesense },
      qdrant: { enabled: qdrant },
    });
  }),
);

router.post(
  '/infra/reindex/search',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const indexed = await TypesenseService.reindexAll();
    return sendSuccess(res, 200, { indexed, backend: 'typesense' });
  }),
);

router.post(
  '/infra/reindex/embeddings',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const indexed = await RecommendationService.reindexAll();
    return sendSuccess(res, 200, { indexed, backend: 'qdrant' });
  }),
);

export default router;

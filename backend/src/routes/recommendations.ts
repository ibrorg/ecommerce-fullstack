import express from 'express';
import RecommendationService from '../services/recommendationService';
import SearchService from '../services/searchService';
import { AppError } from '../middleware/errorHandler';

const router = express.Router();

/**
 * Recommendations routes — vector-based "similar products" + order
 * co-occurrence recommendations.
 *
 *   GET /api/recommendations/similar/:productId?limit=6
 *     → AI-driven (OpenAI embeddings + Qdrant cosine similarity)
 *     → Falls back to category-based related products if AI is disabled
 *
 *   GET /api/recommendations/also-bought/:productId?limit=5
 *     → Order co-occurrence (existing SearchService.getRecommendations)
 *
 *   GET /api/recommendations/related/:productId?limit=5
 *     → Same-category top-rated (existing SearchService.getRelated)
 */

router.get('/similar/:productId', async (req, res, next) => {
  try {
    const productId = req.params.productId;
    const limit = Math.min(Number(req.query.limit) || 6, 10);

    // Try AI-driven similar products first.
    const aiEnabled = await RecommendationService.isEnabled();
    if (aiEnabled) {
      const similar = await RecommendationService.getSimilar(productId, limit);
      if (similar.length > 0) {
        res.json({ success: true, data: similar, source: 'vector' });
        return;
      }
    }

    // Fallback: same-category top-rated.
    const related = await SearchService.getRelated(productId, limit);
    res.json({ success: true, data: related, source: 'category' });
  } catch (err) {
    next(err);
  }
});

router.get('/also-bought/:productId', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 5, 10);
    const recs = await SearchService.getRecommendations(req.params.productId, limit);
    res.json({ success: true, data: recs });
  } catch (err) {
    next(err);
  }
});

router.get('/related/:productId', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 5, 10);
    const related = await SearchService.getRelated(req.params.productId, limit);
    res.json({ success: true, data: related });
  } catch (err) {
    next(err);
  }
});

export default router;

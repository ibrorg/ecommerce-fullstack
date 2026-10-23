import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import searchService from '../services/searchService';

/**
 * Parse a `limit` query param into a sane integer, bounded by `fallback` and `max`.
 * Rejects non-numeric / negative input by falling back to the default.
 */
const parseLimit = (
  value: string | string[] | undefined,
  fallback: number,
  max: number
): number => {
  if (!value) return fallback;
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

// @desc    Autocomplete product name suggestions for typeahead
// @route   GET /api/search/autocomplete?q=...
// @access  Public
export const getAutocomplete = asyncHandler(async (req: Request, res: Response) => {
  const q = (req.query.q as string) || '';
  const limit = parseLimit(req.query.limit as string | string[], 8, 8);
  const suggestions = await searchService.getAutocomplete(q, limit);
  return sendSuccess(res, 200, suggestions);
});

// @desc    Popular search terms (top product names as a proxy until
//          search-term tracking is implemented)
// @route   GET /api/search/popular
// @access  Public
export const getPopular = asyncHandler(async (req: Request, res: Response) => {
  const limit = parseLimit(req.query.limit as string | string[], 10, 10);
  const terms = await searchService.getPopular(limit);
  return sendSuccess(res, 200, terms);
});

// @desc    "Customers also bought" recommendations via order co-occurrence
// @route   GET /api/products/:id/recommendations
// @access  Public
export const getRecommendations = asyncHandler(async (req: Request, res: Response) => {
  const limit = parseLimit(req.query.limit as string | string[], 5, 10);
  const recommendations = await searchService.getRecommendations(req.params.id, limit);
  return sendSuccess(res, 200, recommendations);
});

// @desc    Related products in the same category
// @route   GET /api/products/:id/related
// @access  Public
export const getRelated = asyncHandler(async (req: Request, res: Response) => {
  const limit = parseLimit(req.query.limit as string | string[], 5, 10);
  const related = await searchService.getRelated(req.params.id, limit);
  return sendSuccess(res, 200, related);
});

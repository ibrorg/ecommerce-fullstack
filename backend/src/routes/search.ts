import express from 'express';
import { getAutocomplete, getPopular, search } from '../controllers/searchController';

const router = express.Router();

// Full-text search — Typesense-backed with MongoDB fallback.
// @route   GET /api/search?q=phone&page=1&limit=20
router.get('/', search);

// Autocomplete — prefix-first, contains-fallback (MongoDB).
// @route   GET /api/search/autocomplete?q=phone&limit=8
router.get('/autocomplete', getAutocomplete);

// Popular search terms.
// @route   GET /api/search/popular
router.get('/popular', getPopular);

export default router;

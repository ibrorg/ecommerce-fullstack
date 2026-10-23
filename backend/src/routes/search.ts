import express from 'express';
import { getAutocomplete, getPopular } from '../controllers/searchController';

const router = express.Router();

// Public routes
// @route   GET /api/search/autocomplete?q=phone&limit=8
router.get('/autocomplete', getAutocomplete);

// @route   GET /api/search/popular
router.get('/popular', getPopular);

export default router;

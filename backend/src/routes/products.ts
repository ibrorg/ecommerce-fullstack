import express from 'express';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  getBrands,
  searchProducts,
  getFeaturedProducts,
  getProductsByIds,
  getProductsForCompare,
  addProductReview,
  voteReviewHelpful,
  replyToReview,
  productValidation,
  reviewValidation,
  replyValidation
} from '../controllers/productController';
import { getRecommendations, getRelated } from '../controllers/searchController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/', getProducts);
router.get('/categories', getCategories);
router.get('/brands', getBrands);
router.get('/search', searchProducts);
router.get('/featured', getFeaturedProducts);
router.get('/bulk', getProductsByIds);
router.get('/compare', getProductsForCompare);
router.get('/:id', getProduct);
router.get('/:id/recommendations', getRecommendations);
router.get('/:id/related', getRelated);

// Protected routes
router.post('/:id/reviews', protect, reviewValidation, addProductReview);
router.post('/:id/reviews/:reviewId/vote', protect, voteReviewHelpful);
router.post('/:id/reviews/:reviewId/reply', protect, authorize('seller', 'admin', 'super_admin'), replyValidation, replyToReview);

// Admin only routes
router.post('/', protect, authorize('admin'), productValidation, createProduct);
router.put('/:id', protect, authorize('admin'), productValidation, updateProduct);
router.delete('/:id', protect, authorize('admin'), deleteProduct);

export default router;
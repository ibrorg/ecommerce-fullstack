import { Request, Response } from 'express';
import { validationResult, body } from 'express-validator';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import productService from '../services/productService';
import { sendPaginatedSuccess, sendSuccess, sendValidationError } from '../utils/response';

// Compute merchandising badges from product attributes at read time.
// Badges are derived (not stored) so they stay in sync with data changes
// without a separate model or admin UI.
const computeBadges = (product: any): string[] => {
  const badges: string[] = [];
  const now = Date.now();

  // "New" — created within the last 14 days
  const createdAt = product.createdAt ? new Date(product.createdAt).getTime() : 0;
  if (now - createdAt < 14 * 24 * 60 * 60 * 1000) {
    badges.push('New');
  }

  // "Sale" — has a comparePrice higher than the current price
  if (product.comparePrice && product.comparePrice > product.price) {
    badges.push('Sale');
  }

  // "Top Rated" — rating >= 4.5 with at least 5 reviews
  if (product.rating >= 4.5 && product.numReviews >= 5) {
    badges.push('Top Rated');
  }

  // "Bestseller" — high review count signals popularity
  if (product.numReviews >= 25) {
    badges.push('Bestseller');
  }

  // "Low Stock" — running low, creates urgency
  if (product.countInStock > 0 && product.countInStock <= 5) {
    badges.push('Low Stock');
  }

  return badges;
};

const mapProductPreview = (product: any) => ({
  _id: product._id,
  id: product._id,
  name: product.name,
  description: product.description,
  slug: product.slug,
  price: product.price,
  comparePrice: product.comparePrice,
  category: product.category,
  brand: product.brand,
  image: product.images?.[0],
  images: product.images,
  rating: product.rating,
  numReviews: product.numReviews,
  countInStock: product.countInStock,
  sku: product.sku,
  isFeatured: product.isFeatured,
  createdBy: product.createdBy,
  badges: computeBadges(product),
  createdAt: product.createdAt,
  updatedAt: product.updatedAt
});

const parseNumber = (value?: string | string[], fallback: number = 0) => {
  if (!value) return fallback;
  const parsed = Array.isArray(value) ? parseFloat(value[0]) : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// @desc    Get all products with filtering, search, sorting, and pagination
// @route   GET /api/products
// @access  Public
export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 12, 50);
  const cursor = req.query.cursor as string | undefined;

  const { products, pagination } = await productService.getAll(
    page,
    limit,
    req.query.category as string,
    parseNumber(req.query.minPrice as string),
    parseNumber(req.query.maxPrice as string),
    req.query.search as string,
    req.query.sort as string,
    req.query.brand as string,
    parseNumber(req.query.minRating as string),
    req.query.inStock === 'true',
    req.query.badges as string,
    cursor
  );

  const curated = products.map(mapProductPreview);

  // Cache-Control for the public product list — allows CDN + browser caching
  // for 60s, then stale-while-revalidate for 300s. Vary on Accept-Encoding so
  // gzipped + identity responses cache separately.
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.set('Vary', 'Accept-Encoding');

  // Cursor pagination returns { limit, total, nextCursor } — send a
  // different envelope than offset pagination's { page, limit, total, pages }.
  // Distinguish by checking if `page` is absent (cursor mode never sets it).
  const p = pagination as any;
  if (p.page === undefined) {
    return sendSuccess(res, 200, curated, 'Products loaded', {
      limit: p.limit,
      total: p.total,
      nextCursor: p.nextCursor,
    } as any);
  }

  return sendPaginatedSuccess(res, 200, curated, p.page, p.limit, p.total, 'Products loaded');
});

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.getById(req.params.id);
  return sendSuccess(res, 200, mapProductPreview(product));
});

// @desc    Create new product
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array().map(err => err.msg));
  }

  const product = await productService.create({
    ...req.body,
    createdBy: (req as any).user?.id
  });

  return sendSuccess(res, 201, mapProductPreview(product), 'Product created');
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array().map(err => err.msg));
  }

  const updatedProduct = await productService.update(req.params.id, req.body);
  return sendSuccess(res, 200, mapProductPreview(updatedProduct), 'Product updated');
});

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  await productService.delete(req.params.id);
  return sendSuccess(res, 200, null, 'Product deleted successfully');
});

// @desc    Get product categories
// @route   GET /api/products/categories
// @access  Public
export const getCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await productService.getCategories();
  return sendSuccess(res, 200, categories);
});

// @desc    Get product brands
// @route   GET /api/products/brands
// @access  Public
export const getBrands = asyncHandler(async (_req: Request, res: Response) => {
  const brands = await productService.getBrands();
  return sendSuccess(res, 200, brands);
});

// @desc    Search products
// @route   GET /api/products/search
// @access  Public
export const searchProducts = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query.q as string || '';
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 50);
  
  if (!query.trim()) {
    return sendSuccess(res, 200, []);
  }
  
  const products = await productService.searchProducts(query, limit);
  return sendSuccess(res, 200, products.map(mapProductPreview));
});

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
export const getFeaturedProducts = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 8, 24);
  const products = await productService.getFeatured(limit);
  return sendSuccess(res, 200, products.map(mapProductPreview));
});

// @desc    Get a set of products by id (for recently-viewed widgets)
// @route   GET /api/products/bulk?ids=id1,id2,...
// @access  Public
export const getProductsByIds = asyncHandler(async (req: Request, res: Response) => {
  const raw = (req.query.ids as string) || '';
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20); // cap to keep the query bounded

  if (ids.length === 0) {
    return sendSuccess(res, 200, []);
  }

  const products = await productService.getByIds(ids);
  return sendSuccess(res, 200, products.map(mapProductPreview));
});

// @desc    Get products for side-by-side comparison (fuller projection)
// @route   GET /api/products/compare?ids=id1,id2,id3,id4
// @access  Public
export const getProductsForCompare = asyncHandler(async (req: Request, res: Response) => {
  const raw = (req.query.ids as string) || '';
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return sendSuccess(res, 200, []);
  }

  const products = await productService.getForCompare(ids);
  return sendSuccess(res, 200, products);
});

// @desc    Add product review
// @route   POST /api/products/:id/reviews
// @access  Private
export const addProductReview = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array().map(err => err.msg));
  }

  const user = (req as any).user;
  if (!user) {
    throw new AppError('Unauthorized', 401);
  }

  // optional photos array (max 5, validated in service too)
  const photos = Array.isArray(req.body.photos) ? req.body.photos : [];

  // mark as verified purchase if the buyer has a delivered order for this product
  const isVerifiedPurchase = await productService.checkVerifiedPurchase(
    req.params.id,
    user.id
  );

  const product = await productService.addReview(
    req.params.id,
    user.id,
    user.getFullName(),
    Number(req.body.rating),
    req.body.comment,
    photos,
    isVerifiedPurchase
  );

  const newReview = product.reviews[product.reviews.length - 1];

  return sendSuccess(
    res,
    201,
    {
      review: newReview,
      rating: product.rating,
      numReviews: product.numReviews
    },
    'Review added successfully'
  );
});

// @desc    Vote a review as helpful
// @route   POST /api/products/:id/reviews/:reviewId/vote
// @access  Private
export const voteReviewHelpful = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    throw new AppError('Unauthorized', 401);
  }

  const product = await productService.voteReviewHelpful(
    req.params.id,
    req.params.reviewId,
    user.id
  );

  const review = (product.reviews as any).id(req.params.reviewId);

  return sendSuccess(
    res,
    200,
    {
      helpfulVotes: review?.get('helpfulVotes') || 0
    },
    'Vote recorded'
  );
});

// @desc    Seller/admin reply to a review
// @route   POST /api/products/:id/reviews/:reviewId/reply
// @access  Private (seller/admin)
export const replyToReview = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array().map(err => err.msg));
  }

  const user = (req as any).user;
  if (!user) {
    throw new AppError('Unauthorized', 401);
  }

  const product = await productService.replyToReview(
    req.params.id,
    req.params.reviewId,
    user.id,
    user.role,
    req.body.comment
  );

  const review = (product.reviews as any).id(req.params.reviewId);

  return sendSuccess(
    res,
    200,
    {
      sellerReply: review?.get('sellerReply')
    },
    'Reply added'
  );
});

// Validation rules for product creation/update
export const productValidation = [
  body('name')
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ max: 100 })
    .withMessage('Product name cannot exceed 100 characters'),
  
  body('description')
    .notEmpty()
    .withMessage('Product description is required')
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),
  
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  
  body('comparePrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Compare price must be a positive number'),
  
  body('category')
    .notEmpty()
    .withMessage('Product category is required'),
  
  body('countInStock')
    .isInt({ min: 0 })
    .withMessage('Count in stock must be a non-negative integer'),
  
  body('images')
    .isArray({ min: 1 })
    .withMessage('At least one product image is required'),
  
  body('sku')
    .optional()
    .isLength({ min: 3 })
    .withMessage('SKU must be at least 3 characters long')
];

// Validation rules for product review
export const reviewValidation = [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  
  body('comment')
    .notEmpty()
    .withMessage('Review comment is required')
    .isLength({ max: 500 })
    .withMessage('Review comment cannot exceed 500 characters'),

  body('photos')
    .optional()
    .isArray({ max: 5 })
    .withMessage('Photos must be an array of at most 5 URLs')
];

// Validation rules for a seller reply to a review
export const replyValidation = [
  body('comment')
    .notEmpty()
    .withMessage('Reply comment is required')
    .isLength({ max: 1000 })
    .withMessage('Reply cannot exceed 1000 characters')
];

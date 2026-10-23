import Wishlist, { IWishlist } from '../models/Wishlist';
import Product from '../models/Product';
import { AppError } from '../middleware/errorHandler';
import { CartService } from './cartService';
import mongoose from 'mongoose';

// select fields to populate on Product for wishlist response payloads
const PRODUCT_POPULATE_SELECT = 'name slug price comparePrice images category brand countInStock isActive rating';

export class WishlistService {
  // get or create wishlist for a user — populate product details for display
  async getWishlist(userId: string): Promise<IWishlist> {
    let wishlist = await Wishlist.findOne({ user: userId }).populate(
      'items.product',
      PRODUCT_POPULATE_SELECT
    );
    if (!wishlist) {
      wishlist = await Wishlist.create({ user: userId, items: [] });
    }
    return wishlist;
  }

  // add product to wishlist — no-op if already present (prevents duplicates)
  async addItem(userId: string, productId: string): Promise<IWishlist> {
    // verify product exists (soft-deleted products are filtered out by model pre-hooks)
    const productExists = await Product.findById(productId).lean();
    if (!productExists) {
      throw new AppError('Product not found', 404);
    }

    // work on un-populated wishlist for atomic mutation
    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      wishlist = await Wishlist.create({
        user: userId,
        items: [{ product: productId, addedAt: new Date() }]
      });
      await wishlist.populate('items.product', PRODUCT_POPULATE_SELECT);
      return wishlist;
    }

    const alreadyExists = wishlist.items.some(
      (item) => item.product.toString() === productId
    );

    if (!alreadyExists) {
      wishlist.items.push({
        product: new mongoose.Types.ObjectId(productId),
        addedAt: new Date()
      });
      await wishlist.save();
    }

    await wishlist.populate('items.product', PRODUCT_POPULATE_SELECT);
    return wishlist;
  }

  // remove a single product from wishlist — throws 404 if item not present
  async removeItem(userId: string, productId: string): Promise<IWishlist> {
    const wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      throw new AppError('Wishlist not found', 404);
    }

    const before = wishlist.items.length;
    wishlist.items = wishlist.items.filter(
      (item) => item.product.toString() !== productId
    );

    if (wishlist.items.length === before) {
      throw new AppError('Item not in wishlist', 404);
    }

    await wishlist.save();
    await wishlist.populate('items.product', PRODUCT_POPULATE_SELECT);
    return wishlist;
  }

  // remove all items from wishlist (keeps the wishlist document itself)
  async clearWishlist(userId: string): Promise<void> {
    await Wishlist.findOneAndUpdate(
      { user: userId },
      { $set: { items: [] } }
    );
  }

  // move item from wishlist to cart — removes from wishlist, returns productId
  // so the route handler can decide whether to call cartService.addItem
  async moveToCart(
    userId: string,
    productId: string,
    cartService: CartService
  ): Promise<{ productId: string; cart: unknown }> {
    const wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      throw new AppError('Wishlist not found', 404);
    }

    const itemExists = wishlist.items.some(
      (item) => item.product.toString() === productId
    );
    if (!itemExists) {
      throw new AppError('Item not in wishlist', 404);
    }

    // remove from wishlist first, then add to cart
    wishlist.items = wishlist.items.filter(
      (item) => item.product.toString() !== productId
    );
    await wishlist.save();

    const cart = await cartService.addItem(userId, productId, 1);
    return { productId, cart };
  }
}

export default new WishlistService();

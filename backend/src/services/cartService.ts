import Cart, { ICart } from '../models/Cart';
import { AppError } from '../middleware/errorHandler';
import mongoose from 'mongoose';

// helper to compare product IDs whether populated or not
function productIdEquals(product: any, id: string): boolean {
  if (mongoose.Types.ObjectId.isValid(product)) {
    return product.toString() === id;
  }
  if (product && product._id) {
    return product._id.toString() === id;
  }
  return false;
}

export class CartService {
  // get or create cart for a user
  async getCart(userId: string): Promise<ICart> {
    let cart = await Cart.findOne({ user: userId }).populate('items.product', 'name price images countInStock');
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }
    return cart;
  }

  // add item to cart — if exists, increment quantity
  async addItem(userId: string, productId: string, quantity: number = 1): Promise<ICart> {
    // work on the un-populated cart for mutations
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      const newCart = await Cart.create({
        user: userId,
        items: [{ product: productId as any, quantity, addedAt: new Date() }]
      });
      await newCart.populate('items.product', 'name price images countInStock');
      return newCart;
    }

    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({
        product: productId as any,
        quantity,
        addedAt: new Date()
      });
    }

    await cart.save();
    await cart.populate('items.product', 'name price images countInStock');
    return cart;
  }

  // update item quantity
  async updateQuantity(userId: string, productId: string, quantity: number): Promise<ICart> {
    if (quantity < 1) {
      throw new AppError('Quantity must be at least 1', 400);
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new AppError('Cart not found', 404);
    }

    const item = cart.items.find((i) => i.product.toString() === productId);
    if (!item) {
      throw new AppError('Item not in cart', 404);
    }

    item.quantity = quantity;
    await cart.save();
    await cart.populate('items.product', 'name price images countInStock');
    return cart;
  }

  // remove item from cart
  async removeItem(userId: string, productId: string): Promise<ICart> {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new AppError('Cart not found', 404);
    }

    cart.items = cart.items.filter((i) => i.product.toString() !== productId);
    await cart.save();
    await cart.populate('items.product', 'name price images countInStock');
    return cart;
  }

  // clear cart (after order placed)
  async clearCart(userId: string): Promise<void> {
    await Cart.findOneAndUpdate(
      { user: userId },
      { $set: { items: [] } }
    );
  }

  // merge guest cart (from localStorage) into server cart on login
  // sums quantities if product already in server cart
  async mergeGuestCart(userId: string, guestItems: Array<{ product: string; quantity: number }>): Promise<ICart> {
    if (!guestItems || guestItems.length === 0) {
      return this.getCart(userId);
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    for (const guestItem of guestItems) {
      const existing = cart.items.find(
        (i) => i.product.toString() === guestItem.product
      );

      if (existing) {
        existing.quantity += guestItem.quantity;
      } else {
        cart.items.push({
          product: guestItem.product as any,
          quantity: guestItem.quantity,
          addedAt: new Date()
        });
      }
    }

    await cart.save();
    await cart.populate('items.product', 'name price images countInStock');
    return cart;
  }
}

export default new CartService();

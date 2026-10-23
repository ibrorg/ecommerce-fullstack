import Store from '../models/Store';
import Product from '../models/Product';
import Order from '../models/Order';
import Withdrawal from '../models/Withdrawal';
import { AppError } from '../middleware/errorHandler';
import mongoose from 'mongoose';

export class SellerService {
  // Create seller store
  async createStore(userId: string, data: any) {
    // Check if user already has a store
    const existingStore = await Store.findOne({ owner: userId });
    if (existingStore) {
      throw new AppError('You already have a store', 400);
    }

    const store = await Store.create({
      ...data,
      owner: userId,
      slug: data.name.toLowerCase().replace(/\s+/g, '-')
    });

    return store;
  }

  // Get seller store
  async getStore(userId: string) {
    const store = await Store.findOne({ owner: userId })
      .populate('owner', 'firstName lastName email avatar');

    if (!store) {
      throw new AppError('Store not found', 404);
    }

    return store;
  }

  // Update store
  async updateStore(userId: string, data: any) {
    const store = await Store.findOneAndUpdate(
      { owner: userId },
      { ...data, metadata: { ...data.metadata, lastUpdated: new Date() } },
      { new: true, runValidators: true }
    );

    if (!store) {
      throw new AppError('Store not found', 404);
    }

    return store;
  }

  // Get seller products
  async getSellerProducts(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const store = await Store.findOne({ owner: userId });

    if (!store) {
      throw new AppError('Store not found', 404);
    }

    const [products, total] = await Promise.all([
      Product.find({ createdBy: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments({ createdBy: userId })
    ]);

    return {
      products,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }

  // Get seller orders
  async getSellerOrders(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const store = await Store.findOne({ owner: userId });

    if (!store) {
      throw new AppError('Store not found', 404);
    }

    // Get orders containing products from this seller
    const [orders, total] = await Promise.all([
      Order.aggregate([
        {
          $lookup: {
            from: 'products',
            localField: 'orderItems.product',
            foreignField: '_id',
            as: 'products'
          }
        },
        {
          $match: { 'products.createdBy': new mongoose.Types.ObjectId(userId) }
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit }
      ]),
      Order.countDocuments() // Simplified count
    ]);

    return {
      orders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }

  // Get seller earnings
  async getSellerEarnings(userId: string, startDate?: Date, endDate?: Date) {
    const query: any = {
      isPaid: true,
      orderStatus: { $in: ['shipped', 'delivered'] }
    };

    if (startDate || endDate) {
      query.paidAt = {};
      if (startDate) query.paidAt.$gte = startDate;
      if (endDate) query.paidAt.$lte = endDate;
    }

    const earnings = await Order.aggregate([
      { $match: query },
      { $unwind: '$orderItems' },
      {
        $lookup: {
          from: 'products',
          localField: 'orderItems.product',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $match: { 'product.createdBy': new mongoose.Types.ObjectId(userId) }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $multiply: ['$orderItems.quantity', '$orderItems.price'] } },
          totalOrders: { $sum: 1 },
          totalItems: { $sum: '$orderItems.quantity' }
        }
      }
    ]);

    const store = await Store.findOne({ owner: userId });
    const commission = store?.commissionRate || 10;
    const totalEarnings = earnings[0]?.totalRevenue || 0;
    const platformFee = (totalEarnings * commission) / 100;
    const netEarnings = totalEarnings - platformFee;

    return {
      totalRevenue: totalEarnings,
      platformCommission: commission,
      platformFee,
      netEarnings,
      totalOrders: earnings[0]?.totalOrders || 0,
      totalItems: earnings[0]?.totalItems || 0
    };
  }

  // Get seller dashboard stats
  async getSellerDashboard(userId: string) {
    const [
      store,
      earnings,
      recentOrders,
      topProducts,
      totalProducts
    ] = await Promise.all([
      Store.findOne({ owner: userId }),
      this.getSellerEarnings(userId),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Product.find({ createdBy: userId })
        .sort({ rating: -1 })
        .limit(5)
        .lean(),
      Product.countDocuments({ createdBy: userId })
    ]);

    return {
      store,
      earnings,
      recentOrders,
      topProducts,
      totalProducts,
      storeStats: {
        followers: store?.followers?.length || 0,
        rating: store?.rating || 0,
        totalReviews: store?.totalReviews || 0
      }
    };
  }

  // Request withdrawal
  async requestWithdrawal(userId: string, amount: number, bankDetails: any) {
    const store = await Store.findOne({ owner: userId });

    if (!store) {
      throw new AppError('Store not found', 404);
    }

    if (store.totalEarnings < amount) {
      throw new AppError('Insufficient balance for withdrawal', 400);
    }

    const withdrawal = await Withdrawal.create({
      seller: userId,
      amount,
      bankDetails
    });

    return withdrawal;
  }

  // Get withdrawal history
  async getWithdrawals(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [withdrawals, total] = await Promise.all([
      Withdrawal.find({ seller: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Withdrawal.countDocuments({ seller: userId })
    ]);

    return {
      withdrawals,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }

  // Get public store profile
  async getPublicStore(slug: string) {
    const store = await Store.findOne({ slug, isActive: true })
      .populate('owner', 'firstName lastName')
      .lean();

    if (!store) {
      throw new AppError('Store not found', 404);
    }

    // Increment views
    await Store.updateOne({ _id: store._id }, { $inc: { 'metadata.views': 1 } });

    // Get store products
    const products = await Product.find({ createdBy: store.owner._id })
      .limit(20)
      .lean();

    return {
      ...store,
      products
    };
  }

  // Follow/Unfollow store
  async toggleFollowStore(userId: string, storeId: string) {
    const store = await Store.findById(storeId);

    if (!store) {
      throw new AppError('Store not found', 404);
    }

    const isFollowing = store.followers.includes(new mongoose.Types.ObjectId(userId));

    if (isFollowing) {
      await Store.updateOne(
        { _id: storeId },
        { $pull: { followers: userId } }
      );
    } else {
      await Store.updateOne(
        { _id: storeId },
        { $push: { followers: userId } }
      );
    }

    return { following: !isFollowing };
  }

  // seller creates a product under their own store
  async createSellerProduct(userId: string, data: any) {
    const store = await Store.findOne({ owner: userId });
    if (!store) {
      throw new AppError('You must create a store first', 400);
    }

    // check SKU uniqueness
    const existing = await Product.findOne({ sku: data.sku });
    if (existing) {
      throw new AppError('Product with this SKU already exists', 400);
    }

    const product = await Product.create({
      ...data,
      createdBy: userId
    });

    // bump store product counter
    await Store.findByIdAndUpdate(store._id, { $inc: { totalProducts: 1 } });

    return product;
  }

  // seller deletes their own product (soft delete)
  async deleteSellerProduct(userId: string, productId: string) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    if (product.createdBy?.toString() !== userId) {
      throw new AppError('Not authorized to delete this product', 403);
    }

    product.deletedAt = new Date();
    product.isActive = false;
    await product.save();

    await Store.findOneAndUpdate(
      { owner: userId },
      { $inc: { totalProducts: -1 } }
    );

    return product;
  }
}

export default new SellerService();

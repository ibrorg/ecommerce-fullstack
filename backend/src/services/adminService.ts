import Order from '../models/Order';
import Product from '../models/Product';
import User from '../models/User';
import Store from '../models/Store';
import Analytics from '../models/Analytics';
import { AppError } from '../middleware/errorHandler';

export class AdminDashboardService {
  // Get overall platform statistics
  async getPlatformStats() {
    const [
      totalUsers,
      totalOrders,
      totalProducts,
      totalStores,
      totalRevenue,
      paidOrders
    ] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      Product.countDocuments(),
      Store.countDocuments(),
      Order.aggregate([
        { $match: { isPaid: true } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
      ]),
      Order.countDocuments({ isPaid: true })
    ]);

    const revenueValue = totalRevenue[0]?.total || 0;

    return {
      totalUsers,
      totalOrders,
      totalProducts,
      totalStores,
      totalRevenue: revenueValue,
      paidOrders,
      conversionRate: totalOrders > 0 ? ((paidOrders / totalOrders) * 100).toFixed(2) : 0,
      averageOrderValue: paidOrders > 0 ? (revenueValue / paidOrders).toFixed(2) : 0
    };
  }

  // Get daily/monthly revenue trends
  async getRevenueTrends(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trends = await Order.aggregate([
      {
        $match: {
          isPaid: true,
          paidAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$paidAt' }
          },
          revenue: { $sum: '$totalPrice' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return trends;
  }

  // Get top selling products
  async getTopProducts(limit: number = 10) {
    const topProducts = await Order.aggregate([
      { $match: { isPaid: true } },
      { $unwind: '$orderItems' },
      {
        $group: {
          _id: '$orderItems.product',
          name: { $first: '$orderItems.name' },
          sold: { $sum: '$orderItems.quantity' },
          revenue: { $sum: { $multiply: ['$orderItems.quantity', '$orderItems.price'] } }
        }
      },
      { $sort: { sold: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      }
    ]);

    return topProducts;
  }

  // Get user growth over time
  async getUserGrowth(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const growth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          newUsers: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return growth;
  }

  // Get category performance
  async getCategoryPerformance() {
    const categories = await Order.aggregate([
      { $match: { isPaid: true } },
      { $unwind: '$orderItems' },
      {
        $lookup: {
          from: 'products',
          localField: 'orderItems.product',
          foreignField: '_id',
          as: 'productData'
        }
      },
      { $unwind: '$productData' },
      {
        $group: {
          _id: '$productData.category',
          totalSales: { $sum: '$orderItems.quantity' },
          totalRevenue: { $sum: { $multiply: ['$orderItems.quantity', '$orderItems.price'] } }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    return categories;
  }

  // Get seller performance metrics
  async getTopSellers(limit: number = 10) {
    const topSellers = await Store.find()
      .populate('owner', 'firstName lastName email')
      .sort({ totalEarnings: -1 })
      .limit(limit)
      .lean();

    return topSellers;
  }

  // Get order status distribution
  async getOrderStatusDistribution() {
    const distribution = await Order.aggregate([
      {
        $group: {
          _id: '$orderStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    return distribution;
  }

  // Get customer insights
  async getCustomerInsights() {
    const [
      totalCustomers,
      returnCustomers,
      averageSpent,
      topCustomers
    ] = await Promise.all([
      User.countDocuments({ role: 'buyer' }),
      User.aggregate([
        {
          $lookup: {
            from: 'orders',
            localField: '_id',
            foreignField: 'user',
            as: 'orders'
          }
        },
        {
          $match: { 'orders.1': { $exists: true } }
        },
        { $count: 'total' }
      ]),
      Order.aggregate([
        { $match: { isPaid: true } },
        {
          $group: {
            _id: '$user',
            spent: { $sum: '$totalPrice' }
          }
        },
        {
          $group: {
            _id: null,
            average: { $avg: '$spent' }
          }
        }
      ]),
      Order.aggregate([
        { $match: { isPaid: true } },
        {
          $group: {
            _id: '$user',
            totalSpent: { $sum: '$totalPrice' },
            orderCount: { $sum: 1 }
          }
        },
        { $sort: { totalSpent: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        }
      ])
    ]);

    return {
      totalCustomers,
      returnCustomers: returnCustomers[0]?.total || 0,
      averageSpent: averageSpent[0]?.average || 0,
      topCustomers
    };
  }

  // Get pending verifications
  async getPendingVerifications() {
    const pendingStores = await Store.find({ isVerified: false })
      .populate('owner', 'firstName lastName email')
      .sort({ createdAt: -1 });

    return pendingStores;
  }

  // Verify seller store — keep Store and User.seller in sync
  async verifyStore(storeId: string) {
    const store = await Store.findByIdAndUpdate(
      storeId,
      { isVerified: true },
      { new: true }
    );

    if (!store) {
      throw new AppError('Store not found', 404);
    }

    // sync the embedded seller profile so the two sources of truth agree
    await User.findByIdAndUpdate(store.owner, {
      $set: {
        'seller.verificationStatus': 'verified',
        'seller.verifiedAt': new Date(),
        'seller.verifiedBy': store.owner
      }
    });

    return store;
  }

  // Get payment metrics
  async getPaymentMetrics() {
    const [
      totalPaymentsMade,
      pendingPayments,
      failedPayments
    ] = await Promise.all([
      Order.countDocuments({ isPaid: true }),
      Order.countDocuments({ isPaid: false, orderStatus: { $ne: 'cancelled' } }),
      Order.countDocuments({ isPaid: false, orderStatus: 'cancelled' })
    ]);

    return {
      totalPaymentsMade,
      pendingPayments,
      failedPayments
    };
  }
}

export default new AdminDashboardService();

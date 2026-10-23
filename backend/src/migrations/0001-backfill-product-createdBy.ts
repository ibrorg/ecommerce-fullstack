import mongoose from 'mongoose';
import connectDB from '../config/database';
import Product from '../models/Product';
import User from '../models/User';

// backfill createdBy on existing products so seller dashboards work
// assign to the first admin user, fallback to first user found
export const backfillProductCreatedBy = async () => {
  try {
    await connectDB();

    const admin = await User.findOne({ role: { $in: ['admin', 'super_admin'] } });
    if (!admin) {
      console.error('No admin user found — create an admin first with seed:admin');
      process.exitCode = 1;
      return;
    }

    const result = await Product.updateMany(
      { createdBy: { $exists: false } },
      { $set: { createdBy: admin._id } }
    );

    console.log(`Backfilled createdBy on ${result.modifiedCount} products`);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    mongoose.connection.close();
  }
};

if (require.main === module) {
  backfillProductCreatedBy();
}

export default backfillProductCreatedBy;

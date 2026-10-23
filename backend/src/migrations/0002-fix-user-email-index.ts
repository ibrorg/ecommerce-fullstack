import mongoose from 'mongoose';
import connectDB from '../config/database';

// drop the legacy email_1 unique index and let Mongoose recreate it
// with the partialFilterExpression on deletedAt: null
// so soft-deleted users can re-register with the same email (GDPR)
export const fixUserEmailIndex = async () => {
  try {
    await connectDB();
    const db = mongoose.connection.db;
    if (!db) {
      console.error('DB handle unavailable');
      process.exitCode = 1;
      return;
    }
    const collection = db.collection('users');

    // drop legacy index if present
    try {
      await collection.dropIndex('email_1');
      console.log('Dropped legacy email_1 index');
    } catch (err: any) {
      if (err?.codeName === 'IndexNotFound') {
        console.log('Legacy email_1 index not present, nothing to drop');
      } else {
        throw err;
      }
    }

    // create the new partial-filter unique index explicitly
    try {
      await collection.createIndex(
        { email: 1 },
        {
          unique: true,
          name: 'email_unique_active',
          partialFilterExpression: { deletedAt: null }
        }
      );
      console.log('Created email_unique_active partial-filter index');
    } catch (err: any) {
      if (err?.code === 11000) {
        console.log('Index already exists, skipping creation');
      } else {
        throw err;
      }
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    mongoose.connection.close();
  }
};

if (require.main === module) {
  fixUserEmailIndex();
}

export default fixUserEmailIndex;

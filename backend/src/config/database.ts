import mongoose from 'mongoose';

/**
 * MongoDB connection configuration and handling
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce';
    
    await mongoose.connect(mongoURI);

    console.log('✅ MongoDB connected successfully');
    
    // Connection event handlers
    mongoose.connection.on('error', (error) => {
      console.error('❌ MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    throw error;
  }
};

/**
 * Graceful shutdown handler
 */
export const setupGracefulShutdown = () => {
  process.on('SIGINT', async () => {
    console.log('📤 Shutting down gracefully...');
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
};

export default connectDatabase;
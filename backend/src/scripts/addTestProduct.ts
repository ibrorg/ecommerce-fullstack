import mongoose from 'mongoose';
import Product from '../models/Product';

const testProduct = {
  name: 'Test Product',
  description: 'This is a test product',
  price: 99.99,
  category: 'Electronics',
  countInStock: 10,
  images: ['https://picsum.photos/400'],
  sku: 'TEST001'
};

async function addTestProduct() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce');
    console.log('Connected to MongoDB');

    // Create test product
    const product = await Product.create(testProduct);
    console.log('Test product created:', product);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addTestProduct();
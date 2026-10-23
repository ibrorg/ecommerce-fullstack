import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product';

dotenv.config();

const sampleProducts = [
  {
    name: 'Wireless Bluetooth Headphones',
    description: 'High-quality wireless headphones with noise cancellation and 30-hour battery life.',
    price: 199.99,
    images: ['https://picsum.photos/400x400?text=Headphones'],
    category: 'Electronics',
    countInStock: 25,
    rating: 4.5,
    numReviews: 128,
    sku: 'WBH-001',
    slug: 'wireless-bluetooth-headphones'
  },
  {
    name: 'Smart Fitness Watch',
    description: 'Advanced fitness tracker with heart rate monitoring, GPS, and smartphone integration.',
    price: 299.99,
    images: ['https://picsum.photos/400x400?text=Smart+Watch'],
    category: 'Electronics',
    countInStock: 15,
    rating: 4.3,
    numReviews: 89,
    sku: 'SFW-002',
    slug: 'smart-fitness-watch'
  },
  {
    name: 'Organic Cotton T-Shirt',
    description: 'Comfortable and sustainable organic cotton t-shirt available in multiple colors.',
    price: 29.99,
    images: ['https://picsum.photos/400x400?text=T-Shirt'],
    category: 'Clothing',
    countInStock: 50,
    rating: 4.7,
    numReviews: 203,
    sku: 'OCT-003',
    slug: 'organic-cotton-t-shirt'
  },
  {
    name: 'Professional Coffee Maker',
    description: 'Premium coffee maker with programmable settings and thermal carafe.',
    price: 149.99,
    images: ['https://picsum.photos/400x400?text=Coffee+Maker'],
    category: 'Home & Kitchen',
    countInStock: 12,
    rating: 4.4,
    numReviews: 67,
    sku: 'PCM-004',
    slug: 'professional-coffee-maker'
  },
  {
    name: 'Yoga Mat Premium',
    description: 'Non-slip yoga mat made from eco-friendly materials, perfect for all yoga practices.',
    price: 79.99,
    images: ['https://picsum.photos/400x400?text=Yoga+Mat'],
    category: 'Sports & Outdoors',
    countInStock: 30,
    rating: 4.6,
    numReviews: 145,
    sku: 'YMP-005',
    slug: 'yoga-mat-premium'
  },
  {
    name: 'Wireless Phone Charger',
    description: 'Fast wireless charging pad compatible with all Qi-enabled devices.',
    price: 39.99,
    images: ['https://picsum.photos/400x400?text=Wireless+Charger'],
    category: 'Electronics',
    countInStock: 40,
    rating: 4.2,
    numReviews: 92,
    sku: 'WPC-006',
    slug: 'wireless-phone-charger'
  }
];

const seedProducts = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce';
    await mongoose.connect(mongoURI);
    
    console.log('Connected to MongoDB');
    
    // Clear existing products
    await Product.deleteMany({});
    console.log('Cleared existing products');
    
    // Insert sample products
    const products = await Product.insertMany(sampleProducts);
    console.log(`Inserted ${products.length} sample products`);
    
    console.log('Sample products seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding products:', error);
    process.exit(1);
  }
};

seedProducts();
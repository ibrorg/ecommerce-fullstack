import mongoose from 'mongoose';
import Product from '../models/Product';

const sampleProducts = [
  {
    name: 'Premium Laptop',
    description: 'High-performance laptop with latest processor, 16GB RAM, and SSD storage. Perfect for work and gaming.',
    price: 1299.99,
    category: 'Electronics',
    countInStock: 15,
    images: ['https://picsum.photos/400x400/1f2937/ffffff?text=Premium+Laptop'],
    sku: 'LAPTOP001',
    slug: 'premium-laptop',
    isFeatured: true
  },
  {
    name: 'Wireless Headphones',
    description: 'Premium noise-canceling wireless headphones with 30-hour battery life and crystal-clear sound.',
    price: 199.99,
    category: 'Electronics',
    countInStock: 25,
    images: ['https://picsum.photos/400x400/3b82f6/ffffff?text=Headphones'],
    sku: 'HEAD001',
    slug: 'wireless-headphones',
    isFeatured: true
  },
  {
    name: 'Smart Watch',
    description: 'Feature-rich smartwatch with health monitoring, GPS, and 7-day battery life.',
    price: 299.99,
    category: 'Electronics',
    countInStock: 20,
    images: ['https://picsum.photos/400x400/10b981/ffffff?text=Smart+Watch'],
    sku: 'WATCH001',
    slug: 'smart-watch'
  },
  {
    name: 'Gaming Mouse',
    description: 'High-precision gaming mouse with RGB lighting and customizable buttons.',
    price: 79.99,
    category: 'Electronics',
    countInStock: 30,
    images: ['https://picsum.photos/400x400/ef4444/ffffff?text=Gaming+Mouse'],
    sku: 'MOUSE001',
    slug: 'gaming-mouse'
  },
  {
    name: 'Mechanical Keyboard',
    description: 'Premium mechanical keyboard with backlit keys and durable switches.',
    price: 159.99,
    category: 'Electronics',
    countInStock: 18,
    images: ['https://picsum.photos/400x400/8b5cf6/ffffff?text=Keyboard'],
    sku: 'KEYB001',
    slug: 'mechanical-keyboard'
  },
  {
    name: 'Coffee Maker',
    description: 'Professional-grade coffee maker with programmable settings and thermal carafe.',
    price: 89.99,
    category: 'Home & Kitchen',
    countInStock: 12,
    images: ['https://picsum.photos/400x400/92400e/ffffff?text=Coffee+Maker'],
    sku: 'COFFEE001',
    slug: 'coffee-maker'
  },
  {
    name: 'Running Shoes',
    description: 'Comfortable running shoes with advanced cushioning and breathable design.',
    price: 129.99,
    category: 'Sports & Outdoors',
    countInStock: 22,
    images: ['https://picsum.photos/400x400/dc2626/ffffff?text=Running+Shoes'],
    sku: 'SHOES001',
    slug: 'running-shoes',
    isFeatured: true
  },
  {
    name: 'Backpack',
    description: 'Durable and spacious backpack with laptop compartment and multiple pockets.',
    price: 49.99,
    category: 'Fashion',
    countInStock: 35,
    images: ['https://picsum.photos/400x400/059669/ffffff?text=Backpack'],
    sku: 'BAG001',
    slug: 'backpack'
  }
];

async function seedProducts() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce');
    console.log('Connected to MongoDB');

    // Clear existing products
    await Product.deleteMany({});
    console.log('Cleared existing products');

    // Create sample products
    const products = await Product.insertMany(sampleProducts);
    console.log(`Created ${products.length} sample products`);

    // Display created products
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} - $${product.price} (${product.sku})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

seedProducts();
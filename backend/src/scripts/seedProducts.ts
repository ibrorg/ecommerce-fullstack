import mongoose from 'mongoose';
import Product, { IReview } from '../models/Product';
import User from '../models/User';
import connectDB from '../config/database';

// guard against accidental prod runs
if (process.env.NODE_ENV === 'production') {
  console.error('seedProducts script is forbidden in production');
  process.exit(1);
}

// Sample product data with real product images
const sampleProducts = [
  {
    sku: 'IPHONE-14-PRO-001',
    name: 'iPhone 14 Pro',
    description: 'The most Pro iPhone yet. Featuring the A16 Bionic chip, Pro camera system, and stunning Super Retina XDR display.',
    price: 999,
    comparePrice: 1099,
    category: 'Electronics',
    subcategory: 'Smartphones',
    brand: 'Apple',
    countInStock: 50,
    isActive: true,
    isFeatured: true,
    images: [
      'https://images.pexels.com/photos/788946/pexels-photo-788946.jpeg?auto=compress&cs=tinysrgb&w=600',
      'https://images.pexels.com/photos/699122/pexels-photo-699122.jpeg?auto=compress&cs=tinysrgb&w=600'
    ],
    tags: ['smartphone', 'apple', 'ios', 'premium'],
    weight: 0.206,
    dimensions: {
      length: 147.5,
      width: 71.5,
      height: 7.85
    }
  },
  {
    sku: 'MACBOOK-AIR-M2-002',
    name: 'MacBook Air M2',
    description: 'Supercharged by M2 chip. The redesigned MacBook Air is more portable than ever and weighs just 2.7 pounds.',
    price: 1199,
    comparePrice: 1299,
    category: 'Electronics',
    subcategory: 'Laptops',
    brand: 'Apple',
    countInStock: 25,
    isActive: true,
    isFeatured: true,
    images: [
      'https://images.pexels.com/photos/18105/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=600',
      'https://images.pexels.com/photos/7974/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=600'
    ],
    tags: ['laptop', 'apple', 'macbook', 'ultrabook'],
    weight: 1.24
  },
  {
    sku: 'NIKE-AIR-MAX-270-003',
    name: 'Nike Air Max 270',
    description: 'The Nike Air Max 270 delivers visible Air cushioning and all-day comfort in a sleek, modern design.',
    price: 150,
    comparePrice: 180,
    category: 'Clothing',
    subcategory: 'Shoes',
    brand: 'Nike',
    countInStock: 100,
    isActive: true,
    isFeatured: false,
    images: [
      'https://images.pexels.com/photos/3261069/pexels-photo-3261069.jpeg?auto=compress&cs=tinysrgb&w=600',
      'https://images.pexels.com/photos/2529157/pexels-photo-2529157.jpeg?auto=compress&cs=tinysrgb&w=600'
    ],
    tags: ['shoes', 'nike', 'sneakers', 'athletic'],
    weight: 0.8
  },
  {
    sku: 'PSYCHOLOGY-MONEY-004',
    name: 'The Psychology of Money',
    description: 'Timeless lessons on wealth, greed, and happiness by Morgan Housel. A bestselling book about financial psychology.',
    price: 14.99,
    comparePrice: 18.99,
    category: 'Books',
    subcategory: 'Finance',
    brand: 'Harriman House',
    countInStock: 200,
    isActive: true,
    isFeatured: true,
    images: [
      'https://images.pexels.com/photos/3938022/pexels-photo-3938022.jpeg?auto=compress&cs=tinysrgb&w=600',
      'https://images.pexels.com/photos/1252899/pexels-photo-1252899.jpeg?auto=compress&cs=tinysrgb&w=600'
    ],
    tags: ['book', 'finance', 'psychology', 'bestseller'],
    weight: 0.3
  },
  {
    sku: 'GAMING-CHAIR-PRO-005',
    name: 'Gaming Chair Pro',
    description: 'Ergonomic gaming chair with RGB lighting, lumbar support, and premium leather upholstery.',
    price: 299,
    comparePrice: 399,
    category: 'Home & Garden',
    subcategory: 'Furniture',
    brand: 'ProGamer',
    countInStock: 30,
    isActive: true,
    isFeatured: false,
    images: [
      'https://images.pexels.com/photos/3587620/pexels-photo-3587620.jpeg?auto=compress&cs=tinysrgb&w=600',
      'https://images.pexels.com/photos/6505186/pexels-photo-6505186.jpeg?auto=compress&cs=tinysrgb&w=600'
    ],
    tags: ['chair', 'gaming', 'furniture', 'ergonomic'],
    weight: 25
  },
  {
    sku: 'HEADPHONES-BT-006',
    name: 'Wireless Bluetooth Headphones',
    description: 'Premium noise-cancelling headphones with 30-hour battery life and crystal-clear audio quality.',
    price: 199,
    comparePrice: 249,
    category: 'Electronics',
    subcategory: 'Audio',
    brand: 'SoundTech',
    countInStock: 75,
    isActive: true,
    isFeatured: true,
    images: [
      'https://images.pexels.com/photos/3587478/pexels-photo-3587478.jpeg?auto=compress&cs=tinysrgb&w=600',
      'https://images.pexels.com/photos/3394650/pexels-photo-3394650.jpeg?auto=compress&cs=tinysrgb&w=600'
    ],
    tags: ['headphones', 'wireless', 'audio', 'noise-cancelling'],
    weight: 0.25
  },
  {
    sku: 'YOGA-MAT-PREMIUM-007',
    name: 'Yoga Mat Premium',
    description: 'Eco-friendly yoga mat with superior grip and cushioning. Perfect for all types of yoga and exercise.',
    price: 49.99,
    comparePrice: 69.99,
    category: 'Sports',
    subcategory: 'Fitness',
    brand: 'ZenFlow',
    countInStock: 150,
    isActive: true,
    isFeatured: false,
    images: [
      'https://images.pexels.com/photos/317157/pexels-photo-317157.jpeg?auto=compress&cs=tinysrgb&w=600',
      'https://images.pexels.com/photos/4325158/pexels-photo-4325158.jpeg?auto=compress&cs=tinysrgb&w=600'
    ],
    tags: ['yoga', 'fitness', 'exercise', 'eco-friendly'],
    weight: 1.2
  },
  {
    sku: 'SMARTWATCH-S8-008',
    name: 'Smart Watch Series 8',
    description: 'Advanced health monitoring, GPS tracking, and seamless connectivity in a sleek design.',
    price: 399,
    comparePrice: 449,
    category: 'Electronics',
    subcategory: 'Wearables',
    brand: 'TechWear',
    countInStock: 60,
    isActive: true,
    isFeatured: true,
    images: [
      'https://images.pexels.com/photos/436413/pexels-photo-436413.jpeg?auto=compress&cs=tinysrgb&w=600',
      'https://images.pexels.com/photos/3394741/pexels-photo-3394741.jpeg?auto=compress&cs=tinysrgb&w=600'
    ],
    tags: ['smartwatch', 'fitness', 'health', 'wearable'],
    weight: 0.045
  }
];

// Helper function to generate slug
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-'); // Replace multiple hyphens with single hyphen
};

export const seedProducts = async () => {
  try {
    await connectDB();
    
    // Clear existing products
    await Product.deleteMany({});
    console.log('Cleared existing products');
    
    // Get a user to assign as creator (admin user)
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('❌ No admin user found. Please create an admin user first.');
      return;
    }
    
    // Map products with creator and slug
    const productsWithCreator = sampleProducts.map((product) => ({
      ...product,
      slug: generateSlug(product.name),
      createdBy: adminUser._id
    }));
    
    // Insert sample products
    const createdProducts = await Product.insertMany(productsWithCreator);
    console.log(`Seeded ${createdProducts.length} products`);
    
    // Add some reviews to products
    const adminName = adminUser.getFullName();
    const reviewsData = [
      {
        user: adminUser._id,
        name: adminName,
        rating: 5,
        comment: 'Excellent product! Highly recommended.',
        createdAt: new Date()
      },
      {
        user: adminUser._id,
        name: adminName,
        rating: 4,
        comment: 'Great quality and fast delivery.',
        createdAt: new Date()
      }
    ];
    
    // Add reviews to first few products
    for (let i = 0; i < Math.min(4, createdProducts.length); i++) {
      const product = createdProducts[i];
      const reviewData: IReview = {
        user: adminUser._id as mongoose.Types.ObjectId,
        name: adminName,
        rating: reviewsData[i % reviewsData.length].rating,
        comment: reviewsData[i % reviewsData.length].comment,
        createdAt: new Date()
      } as IReview;
      product.reviews = [reviewData];
      await product.save();
    }
    
    console.log('Added sample reviews');
    console.log('Product seeding completed successfully');
    
  } catch (error) {
    console.error('❌ Error seeding products:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run seeding if this file is executed directly
if (require.main === module) {
  seedProducts();
}
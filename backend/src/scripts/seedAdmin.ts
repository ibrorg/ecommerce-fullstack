import mongoose from 'mongoose';
import User from '../models/User';
import connectDB from '../config/database';

// guard against accidental prod runs
if (process.env.NODE_ENV === 'production') {
  console.error('seedAdmin script is forbidden in production');
  process.exit(1);
}

export const seedAdmin = async () => {
  try {
    await connectDB();

    // demo buyer — used for local dev login
    const existingDemo = await User.findOne({ email: 'user@example.com' });
    if (existingDemo) {
      console.log('Demo user already exists');
      console.log('Email: user@example.com');
      console.log('Password: User123!@#');
      mongoose.connection.close();
      return;
    }

    const demoUser = new User({
      firstName: 'Demo',
      lastName: 'User',
      email: 'user@example.com',
      role: 'buyer',
      isEmailVerified: true,
      status: 'active'
    });

    await demoUser.setPassword('User123!@#');
    await demoUser.save();

    console.log('Demo user created successfully');
    console.log('Email: user@example.com');
    console.log('Password: User123!@#');
  } catch (error) {
    console.error('Error creating demo user:', error);
  } finally {
    mongoose.connection.close();
  }
};

if (require.main === module) {
  seedAdmin();
}

export default seedAdmin;

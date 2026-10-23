import mongoose from 'mongoose';
import User from '../models/User';
import connectDB from '../config/database';

// guard against accidental prod runs
if (process.env.NODE_ENV === 'production') {
  console.error('resetAdmin script is forbidden in production');
  process.exit(1);
}

export const resetAdmin = async () => {
  try {
    await connectDB();

    // drop the old admin so we can re-create cleanly
    await User.deleteOne({ email: 'admin@example.com' });
    console.log('Cleared existing admin@example.com if any');

    // proper field names: firstName/lastName, passwordHash via setPassword, status active
    const adminUser = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      role: 'admin',
      isEmailVerified: true,
      status: 'active'
    });

    // use the model's argon2id hashing path
    await adminUser.setPassword('Admin123!@#');
    await adminUser.save();

    console.log('Admin user created successfully');
    console.log('Email: admin@example.com');
    console.log('Password: Admin123!@#');
  } catch (error) {
    console.error('Error resetting admin user:', error);
  } finally {
    mongoose.connection.close();
  }
};

if (require.main === module) {
  resetAdmin();
}

export default resetAdmin;

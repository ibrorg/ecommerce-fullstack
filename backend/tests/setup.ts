import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { config } from 'dotenv';

// load test env
config({ path: '.env.test' });

process.env.NODE_ENV = 'test';

jest.setTimeout(30000);

let replSet: MongoMemoryReplSet;

beforeAll(async () => {
  try {
    // disconnect any existing connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    // replica set required for MongoDB transactions in tests
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = replSet.getUri();
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });
  } catch (error) {
    console.error('Failed to start in-memory MongoDB replica set:', error);
    process.exit(1);
  }
}, 60000);

afterAll(async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (replSet) {
      await replSet.stop();
    }
  } catch (error) {
    console.error('Failed to disconnect:', error);
  }
}, 30000);

afterEach(async () => {
  try {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  } catch (_error) {
    // ignore cleanup errors
  }
});

// keep error logs visible during tests so failures are debuggable
// but suppress noisy info/debug logs
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  // keep warn and error visible
};

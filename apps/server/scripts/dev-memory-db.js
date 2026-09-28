import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { main } from '../src/server.js';

// Convenient local demo. Data is temporary; use Docker/Atlas for durable accounts.
const database = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
process.env.MONGODB_URI = database.getUri('memory_chess');
process.env.JWT_SECRET ||= randomBytes(48).toString('hex');
let backend;
try {
  backend = await main({ handleSignals: false });
  console.log('Development database is temporary. All accounts are removed when this process stops.');
} catch (error) {
  await database.stop();
  throw error;
}
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await backend.close();
  await mongoose.disconnect();
  await database.stop();
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

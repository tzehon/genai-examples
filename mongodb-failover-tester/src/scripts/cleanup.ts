import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Cleanup script to remove test data from MongoDB
 */
async function cleanup(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('Error: MONGODB_URI environment variable not set');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('failover-test');

    console.log('Dropping test-operations collection...');
    await db.collection('test-operations').drop().catch(() => {
      console.log('Collection did not exist or already dropped');
    });

    console.log('Cleanup complete!');
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

cleanup();

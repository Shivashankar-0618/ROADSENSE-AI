// server/scripts/reset.js
// Deletes all seeded accounts so you can re-seed fresh
//
// Usage:
//   cd server
//   node scripts/reset.js

require('dotenv').config();
const mongoose = require('mongoose');

const SEED_EMAILS = [
  'superadmin@roadsense.ai',
  'gramadmin@roadsense.ai',
  'trafficadmin@roadsense.ai',
  'user@roadsense.ai',
];

async function reset() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) { console.error('❌  MONGO_URI not set'); process.exit(1); }

    await mongoose.connect(mongoUri);
    console.log('✅  Connected to MongoDB');

    const result = await mongoose.connection.db
      .collection('users')
      .deleteMany({ email: { $in: SEED_EMAILS } });

    console.log(`🗑️   Deleted ${result.deletedCount} seed user(s)`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌  Reset failed:', err.message);
    process.exit(1);
  }
}

reset();
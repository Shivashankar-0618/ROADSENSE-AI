// server/scripts/seed.js
// ─────────────────────────────────────────────────────────────
// RoadSense AI — Database Seeder
// Creates all 4 role accounts + sample data
//
// Usage:
//   cd server
//   node scripts/seed.js
// ─────────────────────────────────────────────────────────────

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// ── Inline User schema (no import needed) ────────────────────
const userSchema = new mongoose.Schema({
  name:            String,
  email:           { type: String, unique: true },
  phone:           String,
  password:        String,
  role:            { type: String, enum: ['user', 'gram_admin', 'traffic_admin', 'super_admin'], default: 'user' },
  isActive:        { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: true },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

// ── Seed accounts ─────────────────────────────────────────────
const SEED_USERS = [
  {
    name:  'Super Admin',
    email: 'superadmin@roadsense.ai',
    phone: '9000000001',
    password: 'SuperAdmin@123',
    role: 'super_admin',
  },
  {
    name:  'Gram Admin',
    email: 'gramadmin@roadsense.ai',
    phone: '9000000002',
    password: 'GramAdmin@123',
    role: 'gram_admin',
  },
  {
    name:  'Traffic Admin',
    email: 'trafficadmin@roadsense.ai',
    phone: '9000000003',
    password: 'TrafficAdmin@123',
    role: 'traffic_admin',
  },
  {
    name:  'Test User',
    email: 'user@roadsense.ai',
    phone: '9000000004',
    password: 'User@123',
    role: 'user',
  },
];

async function seed() {
  try {
    // ── Connect ──────────────────────────────────────────────
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('\n❌  MONGO_URI not found in .env\n');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('\n✅  Connected to MongoDB\n');

    // ── Upsert each user ─────────────────────────────────────
    for (const userData of SEED_USERS) {
      const hashed = await bcrypt.hash(userData.password, 12);

      await User.findOneAndUpdate(
        { email: userData.email },
        {
          name:            userData.name,
          phone:           userData.phone,
          password:        hashed,
          role:            userData.role,
          isActive:        true,
          isEmailVerified: true,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const roleColors = {
        super_admin:   '\x1b[35m', // purple
        gram_admin:    '\x1b[32m', // green
        traffic_admin: '\x1b[33m', // yellow
        user:          '\x1b[36m', // cyan
      };
      const reset = '\x1b[0m';
      const color = roleColors[userData.role] || '';

      console.log(`  ${color}[${userData.role.toUpperCase().padEnd(13)}]${reset}  ${userData.email.padEnd(35)}  pw: ${userData.password}`);
    }

    // ── Summary ──────────────────────────────────────────────
    console.log('\n──────────────────────────────────────────────────────');
    console.log('  🛣️  RoadSense AI — Seed Complete');
    console.log('──────────────────────────────────────────────────────');
    console.log('\n  Login credentials:\n');
    console.log('  \x1b[35mSuper Admin\x1b[0m');
    console.log('    Email   : superadmin@roadsense.ai');
    console.log('    Password: SuperAdmin@123\n');
    console.log('  \x1b[32mGram Admin\x1b[0m');
    console.log('    Email   : gramadmin@roadsense.ai');
    console.log('    Password: GramAdmin@123\n');
    console.log('  \x1b[33mTraffic Admin\x1b[0m');
    console.log('    Email   : trafficadmin@roadsense.ai');
    console.log('    Password: TrafficAdmin@123\n');
    console.log('  \x1b[36mTest User\x1b[0m');
    console.log('    Email   : user@roadsense.ai');
    console.log('    Password: User@123\n');
    console.log('──────────────────────────────────────────────────────\n');

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error('\n❌  Seed failed:', err.message, '\n');
    process.exit(1);
  }
}

seed();
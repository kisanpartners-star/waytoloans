// The ONLY way a Boss account is created. Run: npm run seed:boss
const mongoose = require('mongoose');
const env = require('../config/env');
const connectDB = require('../config/db');
const User = require('../models/User');
const Setting = require('../models/Setting');
const { hashPassword, PASSWORD_REGEX, PASSWORD_MESSAGE } = require('../utils/password');
(async () => {
  const { name, email, password } = env.boss;
  if (!name || !email || !password) throw new Error('Set BOSS_NAME, BOSS_EMAIL and BOSS_PASSWORD in .env');
  if (!PASSWORD_REGEX.test(password)) throw new Error(`BOSS_PASSWORD invalid. ${PASSWORD_MESSAGE}`);
  await connectDB();
  await User.init();
  const existing = await User.findOne({ role: 'boss', deletedAt: null });
  if (existing) console.log(`Boss already exists (${existing.email}). Nothing changed.`);
  else { await User.create({ role: 'boss', companyId: null, name, email: email.toLowerCase(), passwordHash: await hashPassword(password), status: 'active' }); console.log(`Boss created: ${email}`); }
  await Setting.findOneAndUpdate({ key: 'boss' }, { $setOnInsert: { key: 'boss' } }, { upsert: true });
  console.log(`Boss login URL: /${env.bossPanelPath}/login`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });

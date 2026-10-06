const mongoose = require('mongoose');
// Singleton document holding Today Technologies (Boss) branding.
const s = new mongoose.Schema({
  key: { type: String, default: 'boss', unique: true },
  logoUrl: { type: String, default: '' },
  footerLogoUrl: { type: String, default: '' },
  logoText: { type: String, default: 'Today Technologies Pvt Ltd' },
  seoTitle: { type: String, default: 'Banks Zone by Today Technologies' },
  mainHeading: { type: String, default: 'Banks Zone' },
}, { timestamps: true });
module.exports = mongoose.model('Setting', s);

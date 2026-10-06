const mongoose = require('mongoose');
const s = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  slug: { type: String, required: true, index: true },
  content: { type: String, default: '' }, // sanitised rich text (HTML)
  status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  version: { type: Number, default: 1 },
  deletedAt: { type: Date, default: null, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
module.exports = mongoose.model('Policy', s);

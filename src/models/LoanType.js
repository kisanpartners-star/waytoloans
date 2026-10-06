const mongoose = require('mongoose');
const s = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  code: { type: String, trim: true, uppercase: true, maxlength: 20 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  deletedAt: { type: Date, default: null, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
module.exports = mongoose.model('LoanType', s);

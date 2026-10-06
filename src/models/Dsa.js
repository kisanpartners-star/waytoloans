const mongoose = require('mongoose');
const s = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  dsaId: { type: String, required: true, trim: true, maxlength: 40 }, // login ID
  email: { type: String, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  branch: { type: String, required: true, trim: true, maxlength: 120 },
  loanTypeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LoanType' }],
  bankIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bank' }],
  status: { type: String, enum: ['active', 'disabled', 'blocked'], default: 'active', index: true },
  deletedAt: { type: Date, default: null, index: true },
}, { timestamps: true });
module.exports = mongoose.model('Dsa', s);

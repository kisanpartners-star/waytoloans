const mongoose = require('mongoose');
const s = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  bankName: { type: String, required: true, trim: true, maxlength: 120 },
  contactPerson: { type: String, trim: true, maxlength: 120 },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true, maxlength: 400 },
  city: { type: String, trim: true, maxlength: 80 },
  state: { type: String, trim: true, maxlength: 80 },
  pincode: { type: String, trim: true, maxlength: 10 },
  branchName: { type: String, trim: true, maxlength: 120 },
  ifscCode: { type: String, trim: true, uppercase: true, maxlength: 11 },
  status: { type: String, enum: ['active', 'pending', 'rejected', 'disabled', 'blocked'], default: 'active', index: true },
  selfRegistered: { type: Boolean, default: false },
  reviewedAt: Date,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null, index: true },
}, { timestamps: true });
module.exports = mongoose.model('Bank', s);

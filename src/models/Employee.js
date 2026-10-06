const mongoose = require('mongoose');
const s = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  bankId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  employeeId: { type: String, required: true, trim: true, maxlength: 40 }, // login ID
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  loanTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanType', required: true, index: true },
  dsas: [{ _id: false, dsaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dsa' }, dsaName: String, branch: String }],
  status: { type: String, enum: ['active', 'disabled', 'blocked'], default: 'active', index: true },
  deletedAt: { type: Date, default: null, index: true },
}, { timestamps: true });
module.exports = mongoose.model('Employee', s);

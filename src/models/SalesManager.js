const mongoose = require('mongoose');

const assignment = new mongoose.Schema({
  _id: false,
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  branches: [{ type: String, trim: true, maxlength: 120 }],
}, { _id: false });

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  bankId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankPortal', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  employeeId: { type: String, required: true, trim: true, maxlength: 40 },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, trim: true, maxlength: 30 },
  designation: { type: String, trim: true, maxlength: 120, default: 'Sales Manager' },
  companyAssignments: { type: [assignment], default: [] },
  loanTypeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LoanType' }],
  status: { type: String, enum: ['active', 'disabled'], default: 'active', index: true },
  deletedAt: { type: Date, default: null, index: true },
}, { timestamps: true });
schema.index({ bankId: 1, employeeId: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });

module.exports = mongoose.model('SalesManager', schema);

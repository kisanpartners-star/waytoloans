const mongoose = require('mongoose');

const assignment = new mongoose.Schema({
  _id: false,
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  branches: [{ type: String, trim: true, maxlength: 120 }],
}, { _id: false });

const policy = new mongoose.Schema({
  _id: false,
  loanTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanType', required: true },
  minimumAge: Number,
  maximumAge: Number,
  minimumMonthlyIncome: Number,
  minimumCibilScore: Number,
  maximumFoir: Number,
  maximumTenure: Number,
  minimumLoanAmount: Number,
  maximumLoanAmount: Number,
  requiredDocuments: [String],
  active: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now },
}, { _id: false });

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  bankName: { type: String, required: true, trim: true, maxlength: 120 },
  authorisedPersonName: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  employeeId: { type: String, required: true, trim: true, maxlength: 40 },
  companyAssignments: { type: [assignment], default: [] },
  loanTypeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LoanType' }],
  loanPolicies: { type: [policy], default: [] },
  status: { type: String, enum: ['active', 'disabled'], default: 'active', index: true },
  deletedAt: { type: Date, default: null, index: true },
}, { timestamps: true });
schema.index({ employeeId: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });

module.exports = mongoose.model('BankPortal', schema);

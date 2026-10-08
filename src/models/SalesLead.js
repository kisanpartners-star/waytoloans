const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  bankId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankPortal', required: true, index: true },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesManager', required: true, index: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  leadId: { type: String, required: true, trim: true, maxlength: 40, unique: true },
  connector: { type: String, trim: true, maxlength: 120, default: '' },
  customerName: { type: String, required: true, trim: true, maxlength: 120 },
  mobile: { type: String, trim: true, maxlength: 30, default: '' },
  pan: { type: String, trim: true, uppercase: true, maxlength: 20, default: '' },
  email: { type: String, lowercase: true, trim: true, default: '' },
  loanTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanType', required: true },
  amount: { type: Number, min: 0, default: 0 },
  tenure: { type: Number, min: 0, default: 0 },
  employmentType: { type: String, trim: true, maxlength: 80, default: '' },
  monthlySalary: { type: Number, min: 0, default: 0 },
  branch: { type: String, trim: true, maxlength: 120, default: '' },
  stage: { type: String, enum: ['Lead Created', 'Banker Viewed', 'Confirmation Requested', 'Confirmation Received', 'Documents Requested', 'Documents Received', 'Application Processing', 'Credit Verification', 'Approved', 'Disbursed', 'Rejected'], default: 'Lead Created', index: true },
  remarks: { type: String, trim: true, maxlength: 2000, default: '' },
  documents: [{ name: String, status: { type: String, default: 'Pending' }, url: String }],
  stageHistory: [{ stage: String, at: { type: Date, default: Date.now }, remarks: String }],
  emailLog: [{ subject: String, message: String, at: { type: Date, default: Date.now } }],
  deletedAt: { type: Date, default: null, index: true },
}, { timestamps: true });

module.exports = mongoose.model('SalesLead', schema);

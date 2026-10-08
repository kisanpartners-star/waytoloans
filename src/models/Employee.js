const mongoose = require('mongoose');
const s = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true },
  bankId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  name: { type: String, trim: true, maxlength: 120 },
  employeeId: { type: String, trim: true, maxlength: 40 },
  email: { type: String, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  loanTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanType', index: true },
  dsas: [{ _id: false, dsaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dsa' }, dsaName: String, branch: String }],
  dateOfJoining: Date,
  officialEmail: { type: String, lowercase: true, trim: true },
  personalEmail: { type: String, lowercase: true, trim: true },
  altPhone: { type: String, trim: true },
  department: { type: String, trim: true, maxlength: 120 },
  photoUrl: { type: String, default: '' },
  employmentRole: { type: String, trim: true, maxlength: 120 },
  reportingManager: { type: String, trim: true, maxlength: 120 },
  loanTypeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LoanType' }],
  companyAssignments: [{
    _id: false,
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    branches: [{ type: String, trim: true, maxlength: 120 }],
  }],
  isDraft: { type: Boolean, default: false, index: true },
  accountDisabled: { type: Boolean, default: false, index: true },
  status: { type: String, enum: ['active', 'deactive', 'disabled', 'blocked'], default: 'active', index: true },
  deletedAt: { type: Date, default: null, index: true },
}, { timestamps: true });
s.index({ employeeId: 1 }, {
  unique: true,
  partialFilterExpression: { userId: null, isDraft: false, deletedAt: null, employeeId: { $type: 'string' } },
});
s.index({ officialEmail: 1 }, {
  unique: true,
  partialFilterExpression: { userId: null, isDraft: false, deletedAt: null, officialEmail: { $type: 'string' } },
});
module.exports = mongoose.model('Employee', s);

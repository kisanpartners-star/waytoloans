const mongoose = require('mongoose');

const assigneeSchema = new mongoose.Schema({
  _id: false,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  employeeId: { type: String, trim: true, default: '' },
  designation: { type: String, trim: true, default: '' },
  staffType: { type: String, enum: ['employee', 'salesManager'], required: true },
});

const schema = new mongoose.Schema({
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConnectorLead', required: true, index: true },
  connectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Connector', required: true, index: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  bankCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  bankRegistrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankRegistration', required: true },
  bankId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true, index: true },
  bankName: { type: String, required: true, trim: true },
  connectorName: { type: String, required: true, trim: true },
  connectorEmail: { type: String, trim: true, default: '' },
  loanType: { type: String, required: true, trim: true },
  matchScore: { type: Number, required: true, min: 0, max: 100 },
  assignees: { type: [assigneeSchema], required: true, validate: (items) => items.length > 0 },
  applicationSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  submittedAt: { type: Date, required: true, default: Date.now, index: true },
  status: { type: String, enum: ['submitted', 'inReview', 'approved', 'rejected', 'disbursed'], default: 'submitted', index: true },
}, { timestamps: true });

schema.index({ companyId: 1, connectorId: 1, submittedAt: -1 });
schema.index({ bankId: 1, 'assignees.userId': 1, submittedAt: -1 });

module.exports = mongoose.model('LoanSubmission', schema);

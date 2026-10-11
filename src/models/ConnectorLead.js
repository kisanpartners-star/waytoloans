const mongoose = require('mongoose');

const existingLoanSchema = new mongoose.Schema({
  loanType: { type: String, trim: true, maxlength: 80 },
  bankName: { type: String, trim: true, maxlength: 120 },
  amount: { type: Number, min: 0 },
  emi: { type: Number, min: 0 },
  sanctionDate: Date,
}, { _id: false });

const documentSchema = new mongoose.Schema({
  category: { type: String, required: true },
  originalName: { type: String, required: true },
  storageName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
}, { _id: true });

const schema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  connectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Connector', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  leadId: { type: String, required: true, unique: true, index: true },
  loanType: { type: String, required: true, trim: true, maxlength: 80 },
  applicationStatus: { type: String, enum: ['New Loan', 'Balance transfer with top-up'], required: true },
  personalDetails: {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    mobile: { type: String, required: true, trim: true, maxlength: 20 },
    alternativeMobile: { type: String, trim: true, maxlength: 20 },
    email: { type: String, lowercase: true, trim: true, maxlength: 254 },
    officialEmail: { type: String, lowercase: true, trim: true, maxlength: 254 },
    motherName: { type: String, trim: true, maxlength: 120 },
    fatherName: { type: String, trim: true, maxlength: 120 },
    maritalStatus: { type: String, trim: true, maxlength: 30 },
    qualification: { type: String, trim: true, maxlength: 80 },
    aadhaarNumber: { type: String, trim: true, maxlength: 20 },
    panNumber: { type: String, uppercase: true, trim: true, maxlength: 20 },
    dateOfBirth: Date,
    presentAddress: { type: String, trim: true, maxlength: 500 },
    presentPincode: { type: String, trim: true, maxlength: 10 },
    presentResidenceType: { type: String, enum: ['Owned', 'Rent', ''], default: '' },
    yearsAtPresentAddress: { type: Number, min: 0 },
    permanentAddress: { type: String, trim: true, maxlength: 500 },
    permanentPincode: { type: String, trim: true, maxlength: 10 },
    permanentResidenceType: { type: String, enum: ['Owned', 'Rent', ''], default: '' },
    yearsAtPermanentAddress: { type: Number, min: 0 },
  },
  incomeDetails: {
    employmentType: { type: String, required: true, trim: true, maxlength: 40, default: 'Salaried' },
    companyName: { type: String, trim: true, maxlength: 160 },
    netSalary: { type: Number, min: 0 },
    grossSalary: { type: Number, min: 0 },
    salaryMode: { type: String, enum: ['Account transfer', 'UPI', 'Cash', ''] },
    designation: { type: String, trim: true, maxlength: 120 },
    presentCompanyDoj: Date,
    presentCompanyLessThanThreeMonths: { type: Boolean, default: false },
    previousCompanyDoj: Date,
    previousCompanyRelievingDate: Date,
    hasPreviousRelievingLetter: { type: Boolean, default: false },
    companyAddress: { type: String, trim: true, maxlength: 500 },
    totalExperienceMonths: { type: Number, min: 0 },
  },
  requestedLoanAmount: { type: Number, required: true, min: 0 },
  requestedTenureMonths: { type: Number, min: 0 },
  proposedEmi: { type: Number, min: 0 },
  latestCibilScore: { type: Number, min: 0, max: 900 },
  existingLoans: { type: [existingLoanSchema], default: [] },
  hasDelayedPayments: { type: Boolean, default: false },
  delayedPayments: [{
    loanType: { type: String, trim: true, maxlength: 80 },
    month: { type: String, trim: true, maxlength: 20 },
    days: { type: Number, min: 0 },
  }],
  hasLoanSettlement: { type: Boolean, default: false },
  settlementDetails: {
    loanType: { type: String, trim: true, maxlength: 80 },
    overdueAmount: { type: Number, min: 0 },
    paidAmount: { type: Number, min: 0 },
    pendingAmount: { type: Number, min: 0 },
  },
  recentApplications: [{
    bankName: { type: String, trim: true, maxlength: 120 },
    month: { type: String, trim: true, maxlength: 20 },
  }],
  hasRecentApplications: { type: Boolean, default: false },
  documents: { type: [documentSchema], default: [] },
  eligibility: { type: [mongoose.Schema.Types.Mixed], default: [] },
  status: { type: String, enum: ['submitted', 'inReview', 'disabled'], default: 'submitted', index: true },
  deletedAt: { type: Date, default: null, index: true },
}, { timestamps: true });

schema.index({ companyId: 1, connectorId: 1, deletedAt: 1, createdAt: -1 });
module.exports = mongoose.model('ConnectorLead', schema);

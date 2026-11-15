const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, default: 0 },
  url: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: true });

const statusHistorySchema = new mongoose.Schema({
  status: { type: String, required: true },
  by: { type: String, default: 'system' },
  at: { type: Date, default: Date.now },
  note: { type: String, default: '' },
}, { _id: false });

const publicLoanApplicationSchema = new mongoose.Schema({
  applicationNo: { type: String, unique: true, sparse: true, index: true },
  name: { type: String, trim: true },
  mobile: { type: String, trim: true, index: true },
  loanType: { type: String, trim: true },
  flow: { type: String, enum: ['A', 'B', 'C'], index: true },
  status: { type: String, enum: ['draft', 'submitted', 'under_review', 'documents_pending', 'approved', 'rejected', 'closed'], default: 'draft', index: true },
  currentStep: { type: Number, default: 0 },
  accessTokenHash: { type: String },
  formData: { type: mongoose.Schema.Types.Mixed, default: {} },
  documents: [documentSchema],
  eligibleBanks: [{ type: String, trim: true }],
  bossNotes: { type: String, default: '' },
  statusHistory: [statusHistorySchema],
  isViewedByBoss: { type: Boolean, default: false },
  source: { type: String, default: 'website' },
  submittedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

publicLoanApplicationSchema.index({ mobile: 1, loanType: 1 });
publicLoanApplicationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PublicLoanApplication', publicLoanApplicationSchema);

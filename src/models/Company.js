const mongoose = require('mongoose');
const companySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, unique: true, index: true },
  gstin: { type: String, required: true, uppercase: true, trim: true },
  address: { type: String, required: true, trim: true, maxlength: 400 },
  phone: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  altMobile: { type: String, trim: true },
  adminUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['draft', 'live'], default: 'live', index: true },
  enabled: { type: Boolean, default: true },
  blocked: { type: Boolean, default: false },
  loginDisabled: { type: Boolean, default: false },
  maintenanceMode: { type: Boolean, default: false },
  maintenanceMessage: { type: String, default: '' },
  // company branding (co-branding flip)
  brandName: { type: String, trim: true, maxlength: 80 },
  brandTagline: { type: String, trim: true, maxlength: 160 },
  logoUrl: { type: String, default: '' },
  deletedAt: { type: Date, default: null, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
companySchema.index({ name: 'text', email: 'text', gstin: 'text' });
module.exports = mongoose.model('Company', companySchema);

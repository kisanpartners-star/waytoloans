const { Joi, phone, objectId } = require('./common');

const employee = Joi.object({
  employeeId: objectId.allow(null),
  name: Joi.string().trim().max(120).allow(''),
  staffId: Joi.string().trim().max(40).allow(''),
  phone: phone.allow('', null),
  altPhone: phone.allow('', null),
  email: Joi.string().email().lowercase().trim().allow('', null),
  personalEmail: Joi.string().email().lowercase().trim().allow('', null),
  designation: Joi.string().trim().max(120).allow(''),
  employmentRole: Joi.string().trim().max(120).allow(''),
  reportingManager: Joi.string().trim().max(120).allow(''),
  loanTypeIds: Joi.array().items(objectId).max(50).unique().default([]),
  photoUrl: Joi.string().trim().max(500).allow(''),
  companyAssignments: Joi.array().items(Joi.object({
    companyId: objectId.required(),
    branches: Joi.array().items(Joi.string().trim().min(1).max(120)).max(100).unique().default([]),
  })).max(50).unique('companyId').default([]),
  branch: Joi.string().trim().max(120).allow(''),
  department: Joi.string().trim().max(120).allow(''),
  dateOfJoining: Joi.date().iso().allow('', null),
  status: Joi.string().valid('active', 'deactive', 'disabled').default('active'),
});
const policy = Joi.object({
  loanType: Joi.string().trim().min(2).max(80).required(),
  minimumAge: Joi.number().integer().min(18).max(100).allow(null),
  maximumAge: Joi.number().integer().min(18).max(100).allow(null),
  minimumMonthlyIncome: Joi.number().min(0).allow(null),
  minimumCibilScore: Joi.number().integer().min(0).max(900).allow(null),
  maximumFoir: Joi.number().min(0).max(100).allow(null),
  maximumTenure: Joi.number().integer().min(1).allow(null),
  minimumLoanAmount: Joi.number().min(0).allow(null),
  maximumLoanAmount: Joi.number().min(0).allow(null),
  cityStateRestriction: Joi.string().trim().max(500).allow(''),
  employmentTypeRestriction: Joi.string().trim().max(300).allow(''),
  requiredDocuments: Joi.array().items(Joi.string().trim().max(120)).max(30).default([]),
  manualReview: Joi.boolean().default(false),
  active: Joi.boolean().default(true),
  versionHistory: Joi.array().items(Joi.object({ version: Joi.number().integer().min(1), updatedAt: Joi.date().iso(), settings: Joi.object().unknown(true) })).max(50).default([]),
});

exports.saveDraft = Joi.object({
  companyId: objectId.required(),
  loginEmail: Joi.string().email().lowercase().trim().max(254).allow('').default(''),
  loginPassword: Joi.string().min(8).max(128).allow(''),
  confirmPassword: Joi.string().max(128).allow(''),
  bankName: Joi.string().trim().max(120).allow('').default(''),
  authorisedPersonName: Joi.string().trim().max(120).allow('').default(''),
  mobileNumber: phone.allow('', null).default(''),
  employeeId: Joi.string().trim().max(40).allow('').default(''),
  loanTypes: Joi.array().items(Joi.string().trim().min(2).max(80)).unique().max(50).default([]),
  authorisedEmployees: Joi.array().items(employee).max(100).default([]),
  branches: Joi.array().items(Joi.string().trim().min(1).max(120)).unique().max(100).default([]),
  designations: Joi.array().items(Joi.string().trim().min(1).max(120)).unique().max(100).default([]),
  loanPolicies: Joi.array().items(policy).unique('loanType').max(50).default([]),
  informationAccuracyConfirmed: Joi.boolean().default(false),
  authorisationConfirmed: Joi.boolean().default(false),
  termsAccepted: Joi.boolean().default(false),
  dataProtectionAccepted: Joi.boolean().default(false),
  currentStep: Joi.number().integer().min(0).max(5).default(0),
}).custom((value, helpers) => {
  if (value.loginPassword && value.loginPassword !== value.confirmPassword) {
    return helpers.error('any.invalid', { message: 'Password and confirmation do not match' });
  }
  if (!value.loginPassword && value.confirmPassword) {
    return helpers.error('any.invalid', { message: 'Enter a password before confirming it' });
  }
  return value;
}).messages({ 'any.invalid': '{{#message}}' });

exports.submit = Joi.object({ confirm: Joi.boolean().valid(true).required() });
exports.status = Joi.object({ action: Joi.string().valid('disable', 'enable', 'draft').required() });

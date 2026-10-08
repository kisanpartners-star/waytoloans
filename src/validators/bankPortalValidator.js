const { Joi, password, phone, objectId } = require('./common');

const assignment = Joi.object({
  companyId: objectId.required(),
  branches: Joi.array().items(Joi.string().trim().max(120)).default([]),
});
const policy = Joi.object({
  loanTypeId: objectId.required(),
  minimumAge: Joi.number().integer().min(18).max(100).allow(null),
  maximumAge: Joi.number().integer().min(18).max(100).allow(null),
  minimumMonthlyIncome: Joi.number().min(0).allow(null),
  minimumCibilScore: Joi.number().integer().min(0).max(900).allow(null),
  maximumFoir: Joi.number().min(0).max(100).allow(null),
  maximumTenure: Joi.number().integer().min(1).allow(null),
  minimumLoanAmount: Joi.number().min(0).allow(null),
  maximumLoanAmount: Joi.number().min(0).allow(null),
  requiredDocuments: Joi.array().items(Joi.string().trim().max(120)).max(30).default([]),
  active: Joi.boolean().default(true),
});

exports.registration = Joi.object({
  bankName: Joi.string().trim().min(2).max(120).required(),
  authorisedPersonName: Joi.string().trim().min(2).max(120).required(),
  phone: phone.required(),
  employeeId: Joi.string().trim().min(1).max(40).required(),
  email: Joi.string().email().lowercase().trim().required(),
  password,
  confirmPassword: Joi.any().valid(Joi.ref('password')).required().messages({ 'any.only': 'Passwords do not match' }),
  companyAssignments: Joi.array().items(assignment).min(1).max(100).unique('companyId').required(),
  loanTypeIds: Joi.array().items(objectId).min(1).max(50).unique().required(),
});

exports.bankUpdate = Joi.object({
  bankName: Joi.string().trim().min(2).max(120),
  authorisedPersonName: Joi.string().trim().min(2).max(120),
  email: Joi.string().email().lowercase().trim(),
  phone,
  employeeId: Joi.string().trim().min(1).max(40),
  companyAssignments: Joi.array().items(assignment).min(1).max(100).unique('companyId'),
  loanTypeIds: Joi.array().items(objectId).min(1).max(50).unique(),
  loanPolicies: Joi.array().items(policy).max(50).unique('loanTypeId'),
}).min(1);

const employeeFields = {
  name: Joi.string().trim().min(2).max(120).required(),
  employeeId: Joi.string().trim().min(1).max(40).required(),
  email: Joi.string().email().lowercase().trim().required(),
  phone: phone.allow(''),
  designation: Joi.string().trim().max(120).default('Sales Manager'),
  companyAssignments: Joi.array().items(assignment).min(1).max(100).unique('companyId').required(),
  loanTypeIds: Joi.array().items(objectId).min(1).max(50).unique().required(),
};
exports.employee = Joi.object({ ...employeeFields, password });
exports.employeeUpdate = Joi.object({ ...employeeFields, password: password.optional() });

exports.employeeStatus = Joi.object({ action: Joi.string().valid('disable', 'enable').required() });
exports.confirmation = Joi.object({ message: Joi.string().trim().max(2000).allow('') });
exports.documentRequest = Joi.object({ name: Joi.string().valid('PAN Card', 'Aadhaar Card', 'Salary Slip', 'Bank Statement', 'Employment Proof', 'Address Proof', 'Property Documents').required() });
exports.email = Joi.object({
  subject: Joi.string().trim().min(2).max(160).required(),
  message: Joi.string().trim().min(1).max(5000).required(),
});
exports.leadQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
  search: Joi.string().trim().max(120).allow(''),
  companyId: objectId,
  loanTypeId: objectId,
  stage: Joi.string().valid('Lead Created', 'Banker Viewed', 'Confirmation Requested', 'Confirmation Received', 'Documents Requested', 'Documents Received', 'Application Processing', 'Credit Verification', 'Approved', 'Disbursed', 'Rejected'),
  branch: Joi.string().trim().max(120).allow(''),
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso(),
});
exports.lead = Joi.object({
  companyId: objectId.required(),
  loanTypeId: objectId.required(),
  customerName: Joi.string().trim().min(2).max(120).required(),
  connector: Joi.string().trim().max(120).allow(''),
  mobile: phone.allow(''),
  pan: Joi.string().trim().max(20).allow(''),
  email: Joi.string().email().lowercase().allow(''),
  amount: Joi.number().min(0).default(0),
  tenure: Joi.number().integer().min(0).default(0),
  employmentType: Joi.string().trim().max(80).allow(''),
  monthlySalary: Joi.number().min(0).default(0),
  branch: Joi.string().trim().max(120).allow(''),
  stage: Joi.string().valid('Lead Created', 'Banker Viewed', 'Confirmation Requested', 'Confirmation Received', 'Documents Requested', 'Documents Received', 'Application Processing', 'Credit Verification', 'Approved', 'Disbursed', 'Rejected'),
  remarks: Joi.string().trim().max(2000).allow(''),
});

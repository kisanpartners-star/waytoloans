const { Joi } = require('./common');

const text = (max = 160) => Joi.string().trim().max(max).allow('');
const optionalNumber = Joi.number().min(0).allow(null, '');
const date = Joi.date().iso().allow(null, '');

const existingLoan = Joi.object({
  loanType: text(80),
  bankName: text(120),
  amount: optionalNumber,
  emi: optionalNumber,
  sanctionDate: date,
});
const delayedPayment = Joi.object({
  loanType: text(80), month: text(20), days: optionalNumber,
});

const application = Joi.object({
  loanType: Joi.string().trim().min(2).max(80).required(),
  applicationStatus: Joi.string().valid('New Loan', 'Balance transfer with top-up').required(),
  personalDetails: Joi.object({
    name: Joi.string().trim().min(2).max(120).required(),
    mobile: Joi.string().trim().pattern(/^[+]?[0-9]{10,13}$/).required(),
    alternativeMobile: Joi.string().trim().allow('').pattern(/^[+]?[0-9]{10,13}$/),
    email: Joi.string().email().allow(''),
    officialEmail: Joi.string().email().allow(''),
    motherName: text(120), fatherName: text(120),
    maritalStatus: text(30), qualification: text(80),
    aadhaarNumber: Joi.string().trim().pattern(/^[0-9]{12}$/).allow('').messages({ 'string.pattern.base': 'Aadhaar number must contain 12 digits' }),
    panNumber: Joi.string().trim().uppercase().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/).allow('').messages({ 'string.pattern.base': 'Enter a valid PAN number' }),
    dateOfBirth: date,
    presentAddress: text(500), presentPincode: Joi.string().trim().pattern(/^[0-9]{6}$/).allow('').messages({ 'string.pattern.base': 'Pincode must contain 6 digits' }), presentResidenceType: Joi.string().valid('Owned', 'Rent', ''),
    yearsAtPresentAddress: optionalNumber,
    permanentAddress: text(500), permanentPincode: Joi.string().trim().pattern(/^[0-9]{6}$/).allow('').messages({ 'string.pattern.base': 'Pincode must contain 6 digits' }), permanentResidenceType: Joi.string().valid('Owned', 'Rent', ''),
    yearsAtPermanentAddress: optionalNumber,
  }).required(),
  incomeDetails: Joi.object({
    employmentType: Joi.string().valid('Salaried', 'Self-employed', 'Business owner', 'Other').required(),
    companyName: text(160), netSalary: optionalNumber, grossSalary: optionalNumber,
    salaryMode: Joi.string().valid('Account transfer', 'UPI', 'Cash', ''),
    designation: text(120), presentCompanyDoj: date,
    presentCompanyLessThanThreeMonths: Joi.boolean(),
    previousCompanyDoj: date, previousCompanyRelievingDate: date,
    hasPreviousRelievingLetter: Joi.boolean(), companyAddress: text(500),
    totalExperienceMonths: optionalNumber,
  }).required(),
  requestedLoanAmount: Joi.number().min(0).required(),
  requestedTenureMonths: optionalNumber,
  proposedEmi: optionalNumber,
  latestCibilScore: Joi.number().min(0).max(900).allow(null, ''),
  existingLoans: Joi.array().items(existingLoan).max(30).default([]),
  hasDelayedPayments: Joi.boolean().required(),
  delayedPayments: Joi.array().items(delayedPayment).max(30).default([]),
  hasLoanSettlement: Joi.boolean().required(),
  settlementDetails: Joi.object({
    loanType: text(80), overdueAmount: optionalNumber, paidAmount: optionalNumber, pendingAmount: optionalNumber,
  }),
  recentApplications: Joi.array().items(Joi.object({ bankName: text(120), month: text(20) })).max(30).default([]),
  hasRecentApplications: Joi.boolean().required(),
});

const validateApplication = (value, helpers) => {
    let parsed;
    try { parsed = JSON.parse(value); } catch { return helpers.error('any.invalid'); }
    const result = application.validate(parsed, { abortEarly: false, stripUnknown: true });
    if (result.error) return helpers.error('any.invalid', { details: result.error.details.map((item) => item.message).join('; ') });
    return JSON.stringify(result.value);
  };
const validateCategories = (value, helpers) => {
    let parsed;
    try { parsed = JSON.parse(value); } catch { return helpers.error('any.invalid'); }
    if (!Array.isArray(parsed) || parsed.length > 25 || parsed.some((category) => ![
      'panCard', 'aadhaarCard', 'payslip', 'bankStatement', 'photo', 'form16', 'form26as', 'pfStatement', 'other',
    ].includes(category))) return helpers.error('any.invalid');
    return value;
  };
exports.create = Joi.object({
  application: Joi.string().required().custom(validateApplication),
  documentCategories: Joi.string().required().custom(validateCategories),
}).unknown(true);
exports.update = Joi.object({
  application: Joi.string().required().custom(validateApplication),
  documentCategories: Joi.string().default('[]').custom(validateCategories),
}).unknown(true);
exports.status = Joi.object({ action: Joi.string().valid('enable', 'disable').required() });

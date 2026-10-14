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
const businessPerson = Joi.object({
  name: text(120),
  panNumber: Joi.string().trim().uppercase().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/).allow('').messages({ 'string.pattern.base': 'Enter a valid PAN number' }),
  aadhaarNumber: Joi.string().trim().pattern(/^[0-9]{12}$/).allow('').messages({ 'string.pattern.base': 'Aadhaar number must contain 12 digits' }),
  dateOfBirth: date,
  gender: Joi.string().valid('Male', 'Female', ''),
  maritalStatus: Joi.string().valid('Married', 'Single', ''),
  husbandName: text(120),
  relationship: text(120),
  motherName: text(120), fatherName: text(120),
  email: Joi.string().email().allow(''),
  mobile: Joi.string().trim().pattern(/^[+]?[0-9]{10,13}$/).allow('').messages({ 'string.pattern.base': 'Enter a valid mobile number' }),
  presentPermanentSame: Joi.string().valid('Yes', 'No', ''),
  permanentAddress: text(500), residentialAddress: text(500), landmark: text(200),
  residenceType: Joi.string().valid('Owned', 'Rented', ''),
  presentAddress: text(500), presentLandmark: text(200),
  ownedOrRented: Joi.string().valid('Owned', 'Rented', ''),
});
const businessLoan = Joi.object({
  loanType: text(80), bankName: text(120),
  amount: optionalNumber, emi: optionalNumber, sanctionDate: date,
  hasDelayedPayments: Joi.string().valid('Yes', 'No', ''),
  delayLoanType: text(80), delayMonth: text(20), delayDays: optionalNumber,
  hasLoanSettlement: Joi.string().valid('Yes', 'No', ''),
  settlementLoanType: text(80), overdueAmount: optionalNumber, paidAmount: optionalNumber, pendingAmount: optionalNumber,
  latestCibilScore: Joi.number().min(0).max(900).allow(null, ''),
});
const recentBusinessApplication = Joi.object({ bankName: text(120), month: text(20) });
const businessContact = businessPerson.keys({
  existingLoans: Joi.array().items(businessLoan).max(30).default([]),
  hasRecentApplications: Joi.string().valid('Yes', 'No', ''),
  recentApplications: Joi.array().items(recentBusinessApplication).max(30).default([]),
});
const homeFamilyMember = Joi.object({
  name: text(120), relationship: text(120), age: optionalNumber, occupation: text(120),
  incomeType: Joi.string().valid('Salaried', 'Business', 'Self-Employed', 'Agriculture', 'Rental Income', 'Pension', 'Other', ''),
  monthlyIncome: optionalNumber, annualIncome: optionalNumber,
  incomeMode: Joi.string().valid('Account Transfer', 'Cash', 'Both', ''),
  incomeProofAvailable: Joi.array().items(Joi.string().valid('Salary Slip', 'Bank Statement', 'ITR', 'Business Proof', 'Rental Agreement', 'Other')).max(6).default([]),
  incomeProof: text(500),
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
  businessDetails: Joi.object({
    firmName: text(160),
    companyType: Joi.string().valid('Proprietorship', 'Partnership Firm', 'Pvt Ltd', 'LLP', 'Trust', ''),
    proprietorshipFirm: text(160),
    businessAddress: text(500),
    natureOfBusiness: text(160),
    licences: Joi.array().items(Joi.string().valid('GST', 'Labour Licence', 'MSME / UDYAM Aadhaar')).max(3).default([]),
    registeredMonth: Joi.string().pattern(/^[0-9]{4}-[0-9]{2}$/).allow(''),
    itrFiled: Joi.string().valid('Yes', 'No', ''),
    itrYears: Joi.array().items(Joi.object({
      financialYear: Joi.string().valid('2023-24', '2024-25', '2025-26').required(),
      netIncome: optionalNumber, netIncomeNil: Joi.boolean().default(false),
      turnover: optionalNumber, turnoverNil: Joi.boolean().default(false),
    })).length(3),
  }),
  businessApplicant: businessContact,
  coApplicantDetails: businessPerson,
  partnersDirectors: Joi.array().items(businessContact).max(30).default([]),
  homeLoanDetails: Joi.object({
    loanSubType: Joi.string().valid('Secure Loan', 'Home Loan / House Purchase Loan', 'Mortgage Loan / LAP', 'Construction Loan', 'Composite Loan', 'Site Loan', ''),
    projectFlatName: text(160), individualBuildingDuplex: text(160),
    applicantName: text(120), applicantMobile: Joi.string().trim().pattern(/^[+]?[0-9]{10,13}$/).allow(''),
    applicantEmail: Joi.string().email().allow(''), applicantMotherName: text(120),
    applicantFatherName: text(120), applicantSpouseName: text(120),
    birthPlace: text(120), howLongStaying: text(120), presentAddress: text(500),
    monthlyIncome: optionalNumber, incomeType: text(120), optionalIncome: optionalNumber,
    incomeMode: Joi.string().valid('Account Transfer', 'Cash', ''),
    existingLoans: text(1000),
    coApplicant: Joi.object({
      name: text(120), mobile: Joi.string().trim().pattern(/^[+]?[0-9]{10,13}$/).allow(''),
      email: Joi.string().email().allow(''), age: optionalNumber, motherName: text(120),
      fatherName: text(120), spouseName: text(120), relationship: text(120),
      monthlyIncome: optionalNumber, incomeType: text(120), optionalIncome: optionalNumber,
      incomeMode: Joi.string().valid('Account Transfer', 'Cash', ''),
      existingLoans: text(1000),
    }),
    familyMembers: Joi.array().items(homeFamilyMember).max(50).default([]),
    familyIncomeSummary: Joi.object({
      earningMembers: optionalNumber, totalMonthlyIncome: optionalNumber, totalAnnualIncome: optionalNumber,
    }),
    property: Joi.object({
      address: text(500), type: text(120), kathaType: text(120), age: text(120),
      builtUpArea: optionalNumber, floors: optionalNumber, units: optionalNumber,
      srValue: optionalNumber, marketValue: optionalNumber, totalRentalIncome: optionalNumber,
    }),
    negativeAreas: Joi.array().items(Joi.string().valid(
      'High Tension Wire – 200 Metre', 'Raj Kaluve – 200', 'Below 10 Feet Road',
      'Drainage – 200', 'Railway Gate – 200', 'Temple – 200', 'Musjid – 200',
      'Area – 200', 'Samadhi – 200', 'Lake – 200',
    )).max(10).default([]),
    remarks: text(2000),
  }),
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
      'businessApplicantLoan', 'businessApplicantHistory', 'businessPartnerLoan', 'businessPartnerHistory',
      'homeFrontPhoto', 'homeRightSidePhoto', 'homeLeftSidePhoto', 'homeBackSidePhoto',
      'homeRoadPhoto', 'homePropertyVideo', 'homeSaleDeed', 'homeMotherDeed',
      'homeTaxPaidReceipt', 'homeEncumbranceCertificate', 'homeKatha', 'homeSaleDeedInformation',
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

const makeYearOptions = () => {
  const years = [];
  const current = new Date().getFullYear();
  for (let i = current - 2; i <= current + 2; i += 1) years.push(String(i));
  return years;
};

const yearOptions = makeYearOptions();
const financialYears = ['2023-24', '2024-25', '2025-26'];

const baseLoanTypeMap = {
  'Personal Loan': 'A',
  'Business Loan': 'B',
  'Home Loan': 'C',
  'Mortgage Loan / LAP': 'C',
  'Construction Loan': 'C',
  'Home Renovation Loan': 'C',
  'Site Purchase Loan': 'C',
  'Site and Construction Loan': 'C',
  'Car Loan': 'A',
  'Education Loan': 'A',
  'Commercial Vehicle Loan': 'B',
  'Industrial Loan': 'B',
  'Projects Loan': 'B',
};

const commonStartStep = {
  id: 'applicant',
  title: 'Applicant Details',
  sections: [{
    title: 'Customer details',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'mobile', label: 'Mobile No', type: 'tel', required: true, validation: { pattern: '^[6-9]\\d{9}$' } },
      { name: 'loanType', label: 'Loan Type', type: 'select', required: true, options: Object.keys(baseLoanTypeMap) },
    ],
  }],
};

const sharedFlowA = {
  label: 'Personal / Salaried',
  steps: [
    {
      id: 'step-1',
      title: 'Personal Details',
      sections: [{
        title: 'Personal Information',
        fields: [
          { name: 'alternativeMobile', label: 'Alternative mobile no', type: 'tel' },
          { name: 'email', label: 'Email id', type: 'email' },
          { name: 'officialMail', label: 'Official mail id', type: 'email' },
          { name: 'motherName', label: 'Mother name', type: 'text' },
          { name: 'fatherName', label: 'Father name', type: 'text' },
          { name: 'maritalStatus', label: 'Marital status', type: 'select', options: ['Single', 'Married', 'Divorced', 'Widowed'] },
          { name: 'qualification', label: 'Qualification', type: 'text' },
          { name: 'aadhaarNo', label: 'Aadhaar no', type: 'text', validation: { pattern: '^[0-9]{12}$' } },
          { name: 'panNo', label: 'PAN number', type: 'text', validation: { pattern: '^[A-Z]{5}[0-9]{4}[A-Z]$' } },
          { name: 'presentAddress', label: 'Present address', type: 'textarea' },
          { name: 'presentPincode', label: 'Present pincode', type: 'text', validation: { pattern: '^[0-9]{6}$' } },
          { name: 'presentOwnedOrRent', label: 'Owned or Rent', type: 'select', options: ['Owned', 'Rented', 'Family Owned', 'Company Provided'] },
          { name: 'presentAddressYears', label: 'Years at present address', type: 'number' },
          { name: 'samePermanentAddress', label: 'Permanent address same as present address', type: 'checkbox' },
          { name: 'permanentAddress', label: 'Permanent address', type: 'textarea' },
          { name: 'permanentOwnedOrRent', label: 'Permanent owned or rent', type: 'select', options: ['Owned', 'Rented', 'Family Owned', 'Company Provided'] },
          { name: 'permanentAddressYears', label: 'How long staying', type: 'number' },
        ]
      }],
    },
    {
      id: 'step-2',
      title: 'Income Details',
      sections: [{
        title: 'Income details',
        fields: [
          { name: 'employmentType', label: 'Employment type', type: 'radio', options: ['Salaried', 'Self-employed'] },
          { name: 'selfEmployedWarning', label: 'Self-employed customers must apply through Business Loan', type: 'text', showIf: { field: 'employmentType', equals: 'Self-employed' } },
          { name: 'companyName', label: 'Company name', type: 'text', showIf: { field: 'employmentType', equals: 'Salaried' } },
          { name: 'netSalary', label: 'Net salary per month', type: 'number', showIf: { field: 'employmentType', equals: 'Salaried' } },
          { name: 'salaryMode', label: 'Salary mode', type: 'select', options: ['Account transfer', 'UPI', 'Cash'], showIf: { field: 'employmentType', equals: 'Salaried' } },
          { name: 'designation', label: 'Designation', type: 'text', showIf: { field: 'employmentType', equals: 'Salaried' } },
          { name: 'presentCompanyDoj', label: 'Present company DOJ', type: 'month', showIf: { field: 'employmentType', equals: 'Salaried' } },
          { name: 'lessThan3Months', label: 'Less than 3 months in present company?', type: 'radio', options: ['Yes', 'No'], showIf: { field: 'employmentType', equals: 'Salaried' } },
          { name: 'previousCompanyDoj', label: 'Previous company DOJ', type: 'month', showIf: { field: 'lessThan3Months', equals: 'Yes' } },
          { name: 'previousCompanyRelieving', label: 'Previous company relieving', type: 'month', showIf: { field: 'lessThan3Months', equals: 'Yes' } },
          { name: 'relievingLetter', label: 'Previous company relieving letter - do you have?', type: 'radio', options: ['Yes', 'No'], showIf: { field: 'lessThan3Months', equals: 'Yes' } },
          { name: 'companyAddress', label: 'Company address', type: 'textarea', showIf: { field: 'employmentType', equals: 'Salaried' } },
          { name: 'totalExperience', label: 'Total experience', type: 'text', showIf: { field: 'employmentType', equals: 'Salaried' } },
        ]
      }],
    },
    {
      id: 'step-3',
      title: 'Existing Loans',
      sections: [{
        title: 'Existing Loans',
        fields: [
          { name: 'existingLoans', label: 'Existing loans', type: 'repeatable-group', repeatable: true, fields: [
            { name: 'loanType', label: 'Loan type', type: 'text' },
            { name: 'bankName', label: 'Bank name', type: 'text' },
            { name: 'loanAmount', label: 'Loan amount', type: 'number' },
            { name: 'emi', label: 'EMI', type: 'number' },
            { name: 'loanSanctionDate', label: 'Loan sanction date', type: 'date' },
          ] },
          { name: 'delayPayments', label: 'Any delay payments?', type: 'radio', options: ['Yes', 'No'] },
          { name: 'delayPaymentsList', label: 'Delay payment details', type: 'repeatable-group', showIf: { field: 'delayPayments', equals: 'Yes' }, repeatable: true, fields: [
            { name: 'loanType', label: 'Loan type', type: 'text' },
            { name: 'whichMonths', label: 'Which months', type: 'text' },
            { name: 'howManyDays', label: 'How many days', type: 'number' },
          ] },
          { name: 'loanSettlement', label: 'Any loan settlement?', type: 'radio', options: ['Yes', 'No'] },
          { name: 'loanSettlementList', label: 'Settlement details', type: 'repeatable-group', showIf: { field: 'loanSettlement', equals: 'Yes' }, repeatable: true, fields: [
            { name: 'whichLoan', label: 'Which loan', type: 'text' },
            { name: 'overdueAmount', label: 'Overdue amount', type: 'number' },
            { name: 'paidAmount', label: 'Paid amount', type: 'number' },
            { name: 'pendingAmount', label: 'Pending amount', type: 'number' },
          ] },
          { name: 'latestCibil', label: 'Latest CIBIL', type: 'number', validation: { min: 300, max: 900 } },
          { name: 'appliedBanksRecently', label: 'Applied to any bank / non-banking / finance in the last 3 months?', type: 'radio', options: ['Yes', 'No'] },
          { name: 'appliedBanksRecentList', label: 'Previous applications', type: 'repeatable-group', showIf: { field: 'appliedBanksRecently', equals: 'Yes' }, repeatable: true, fields: [
            { name: 'bankNames', label: 'Bank names', type: 'text' },
            { name: 'whichMonth', label: 'Which month', type: 'month' },
          ] },
        ]
      }],
    },
    {
      id: 'step-4',
      title: 'Upload Documents',
      sections: [{
        title: 'Document upload',
        fields: [
          { name: 'panDoc', label: 'PAN card', type: 'file', fileKey: 'pan' },
          { name: 'aadhaarDoc', label: 'Aadhaar card', type: 'file', fileKey: 'aadhaar' },
          { name: 'payslips', label: 'Latest 3 months payslips', type: 'file', multiple: true, fileKey: 'payslips' },
          { name: 'bankStatement', label: 'Latest 3 months bank statement', type: 'file', multiple: true, fileKey: 'bankStatement' },
          { name: 'photo', label: 'Photo', type: 'file', fileKey: 'photo' },
          { name: 'form16', label: 'Form 16 / Form 26AS / PF statement', type: 'file', fileKey: 'form16' },
        ]
      }],
    },
  ],
};

const sharedFlowB = {
  label: 'Business',
  steps: [
    {
      id: 'business-detail',
      title: 'Business Details',
      sections: [{
        title: 'Business details',
        fields: [
          { name: 'firmName', label: 'Firm name', type: 'text' },
          { name: 'companyType', label: 'Company type', type: 'select', options: ['Proprietorship', 'Partnership firm', 'Pvt Ltd', 'LLP', 'Trust'] },
          { name: 'businessAddress', label: 'Business address', type: 'textarea' },
          { name: 'natureOfBusiness', label: 'Nature of business', type: 'text' },
          { name: 'licenceTypes', label: 'Which licence do you have', type: 'multi-checkbox', options: ['GST', 'Labour licence', 'MSME-UDYAM Aadhaar'] },
          { name: 'businessRegistered', label: 'Business registered', type: 'month' },
        ]
      }],
    },
    {
      id: 'itr',
      title: 'ITR Details',
      sections: [{
        title: 'ITR filed',
        fields: [
          { name: 'itrFiled', label: 'ITR Filed?', type: 'radio', options: ['Yes', 'No'] },
          { name: 'itrYears', label: 'Latest 3 years ITR', type: 'group', showIf: { field: 'itrFiled', equals: 'Yes' }, fields: [
            { name: 'itrYear2023_24', label: '2023-24', type: 'group', fields: [
              { name: 'itrNetIncome_2023_24', label: 'Net income', type: 'number' },
              { name: 'itrTurnover_2023_24', label: 'Turnover', type: 'number' },
              { name: 'itrNil_2023_24', label: 'NIL', type: 'checkbox' }
            ] },
            { name: 'itrYear2024_25', label: '2024-25', type: 'group', fields: [
              { name: 'itrNetIncome_2024_25', label: 'Net income', type: 'number' },
              { name: 'itrTurnover_2024_25', label: 'Turnover', type: 'number' },
              { name: 'itrNil_2024_25', label: 'NIL', type: 'checkbox' }
            ] },
            { name: 'itrYear2025_26', label: '2025-26', type: 'group', fields: [
              { name: 'itrNetIncome_2025_26', label: 'Net income', type: 'number' },
              { name: 'itrTurnover_2025_26', label: 'Turnover', type: 'number' },
              { name: 'itrNil_2025_26', label: 'NIL', type: 'checkbox' }
            ] }
          ] }
        ]
      }],
    },
    {
      id: 'applicant',
      title: 'Applicant Details',
      sections: [{
        title: 'Applicant details',
        fields: [
          { name: 'applicantName', label: 'Name', type: 'text' },
          { name: 'applicantPan', label: 'PAN no', type: 'text', validation: { pattern: '^[A-Z]{5}[0-9]{4}[A-Z]$' } },
          { name: 'applicantAadhaar', label: 'Aadhaar no', type: 'text', validation: { pattern: '^[0-9]{12}$' } },
          { name: 'dob', label: 'DOB', type: 'date' },
          { name: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'] },
          { name: 'husbandName', label: 'Husband name', type: 'text', showIf: { field: 'gender', equals: 'Female' } },
          { name: 'motherName', label: 'Mother name', type: 'text' },
          { name: 'fatherName', label: 'Father name', type: 'text' },
          { name: 'mailId', label: 'Mail id', type: 'email' },
          { name: 'mobileNo', label: 'Mobile no', type: 'tel' },
          { name: 'residencySame', label: 'Present and permanent residency same?', type: 'radio', options: ['Yes', 'No'] },
          { name: 'permanentAddress', label: 'Permanent address', type: 'textarea' },
          { name: 'landmark', label: 'Landmark', type: 'text' },
          { name: 'residenceType', label: 'Rented/Owned', type: 'select', options: ['Owned', 'Rented', 'Family Owned'] },
          { name: 'presentAddress', label: 'Present address', type: 'textarea' },
          { name: 'presentLandmark', label: 'Present landmark', type: 'text' },
          { name: 'presentResidenceType', label: 'Present owned or rented', type: 'select', options: ['Owned', 'Rented', 'Family Owned'] },
        ]
      }],
    },
    {
      id: 'coapplicant',
      title: 'Co-Applicant Details',
      sections: [{
        title: 'Co-applicant details',
        fields: [
          { name: 'coApplicants', label: 'Co-applicant', type: 'repeatable-group', repeatable: true, fields: [
            { name: 'name', label: 'Name', type: 'text' },
            { name: 'pan', label: 'PAN no', type: 'text' },
            { name: 'aadhaar', label: 'Aadhaar no', type: 'text' },
            { name: 'dob', label: 'DOB', type: 'date' },
            { name: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'] },
            { name: 'relationship', label: 'Relationship with applicant', type: 'text' },
            { name: 'motherName', label: 'Mother name', type: 'text' },
            { name: 'fatherName', label: 'Father name', type: 'text' },
            { name: 'mailId', label: 'Mail id', type: 'email' },
            { name: 'mobile', label: 'Mobile no', type: 'tel' },
            { name: 'permanentAddress', label: 'Permanent address', type: 'textarea' },
            { name: 'residentialAddress', label: 'Residential address', type: 'textarea' },
            { name: 'landmark', label: 'Landmark', type: 'text' },
          ] },
        ]
      }],
    },
    {
      id: 'partners',
      title: 'Partners / Directors',
      sections: [{
        title: 'Add partners / directors personal details',
        fields: [
          { name: 'partners', label: 'Partners / directors', type: 'repeatable-group', repeatable: true, fields: [
            { name: 'name', label: 'Name', type: 'text' },
            { name: 'pan', label: 'PAN', type: 'text' },
            { name: 'aadhaar', label: 'Aadhaar', type: 'text' },
            { name: 'dob', label: 'DOB', type: 'date' },
            { name: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'] },
            { name: 'motherName', label: 'Mother name', type: 'text' },
            { name: 'fatherName', label: 'Father name', type: 'text' },
            { name: 'mailId', label: 'Mail id', type: 'email' },
            { name: 'mobile', label: 'Mobile', type: 'tel' },
            { name: 'permanentAddress', label: 'Permanent address', type: 'textarea' },
            { name: 'residentialAddress', label: 'Residential address', type: 'textarea' },
            { name: 'landmark', label: 'Landmark', type: 'text' },
          ] },
        ]
      }],
    },
    {
      id: 'business-financials',
      title: 'Financial Details',
      sections: [{
        title: 'Existing loans, delays and recent applications',
        fields: [
          { name: 'businessExistingLoans', label: 'Existing loans', type: 'repeatable-group', repeatable: true, fields: [
            { name: 'loanType', label: 'Loan type', type: 'text' },
            { name: 'bankName', label: 'Bank name', type: 'text' },
            { name: 'loanAmount', label: 'Loan amount', type: 'number' },
            { name: 'emi', label: 'EMI', type: 'number' },
            { name: 'loanSanctionDate', label: 'Loan sanction date', type: 'date' },
          ] },
          { name: 'businessDelayPayments', label: 'Any delay payments?', type: 'radio', options: ['Yes', 'No'] },
          { name: 'businessDelayDetails', label: 'Delay payment details', type: 'repeatable-group', showIf: { field: 'businessDelayPayments', equals: 'Yes' }, repeatable: true, fields: [
            { name: 'loanType', label: 'Loan type', type: 'text' },
            { name: 'whichMonths', label: 'Which months', type: 'text' },
            { name: 'howManyDays', label: 'How many days', type: 'number' },
          ] },
          { name: 'businessSettlement', label: 'Any loan settlement?', type: 'radio', options: ['Yes', 'No'] },
          { name: 'businessSettlementDetails', label: 'Settlement details', type: 'repeatable-group', showIf: { field: 'businessSettlement', equals: 'Yes' }, repeatable: true, fields: [
            { name: 'whichLoan', label: 'Which loan', type: 'text' },
            { name: 'overdueAmount', label: 'Overdue amount', type: 'number' },
            { name: 'paidAmount', label: 'Paid amount', type: 'number' },
            { name: 'pendingAmount', label: 'Pending amount', type: 'number' },
          ] },
          { name: 'businessLatestCibil', label: 'Latest CIBIL', type: 'number' },
          { name: 'businessAppliedBanksRecently', label: 'Applied to any bank/NBFC/finance in last 3 months?', type: 'radio', options: ['Yes', 'No'] },
          { name: 'businessAppliedList', label: 'Recent applications', type: 'repeatable-group', showIf: { field: 'businessAppliedBanksRecently', equals: 'Yes' }, repeatable: true, fields: [
            { name: 'bankNames', label: 'Bank names', type: 'text' },
            { name: 'whichMonth', label: 'Which month', type: 'month' },
          ] },
        ]
      }],
    },
    {
      id: 'business-docs',
      title: 'Upload Documents',
      sections: [{
        title: 'Business documents',
        fields: [
          { name: 'businessPan', label: 'PAN card', type: 'file', fileKey: 'pan' },
          { name: 'businessAadhaar', label: 'Aadhaar card', type: 'file', fileKey: 'aadhaar' },
          { name: 'businessPhoto', label: 'Photo', type: 'file', fileKey: 'photo' },
          { name: 'businessLicence', label: 'GST / Udyam / Licence certificate', type: 'file', fileKey: 'licence' },
          { name: 'businessItr', label: 'Latest 3 years ITR', type: 'file', multiple: true, fileKey: 'itr' },
          { name: 'businessBankStatement', label: 'Latest 12 months bank statement', type: 'file', multiple: true, fileKey: 'bankStatement' },
          { name: 'businessExistingLoanStatements', label: 'Existing loan statements', type: 'file', multiple: true, fileKey: 'loanStatements' },
        ]
      }],
    },
  ],
};

const sharedFlowC = {
  label: 'Secured / Property',
  steps: [
    {
      id: 'property-category',
      title: 'Property Category',
      sections: [{
        title: 'Property and applicant details',
        fields: [
          { name: 'propertyCategory', label: 'Property category', type: 'select', options: ['Home loan / House purchase', 'Project / Flat', 'Individual Building', 'Duplex'] },
          { name: 'name', label: 'Name', type: 'text' },
          { name: 'mobile', label: 'Mobile no', type: 'tel' },
          { name: 'email', label: 'Email id', type: 'email' },
          { name: 'motherName', label: 'Mother name', type: 'text' },
          { name: 'birthPlace', label: 'Birth place', type: 'text' },
          { name: 'howLongStaying', label: 'How long staying', type: 'text' },
          { name: 'presentAddress', label: 'Present address', type: 'textarea' },
          { name: 'fatherName', label: 'Father name', type: 'text' },
          { name: 'spouseName', label: 'Husband/Wife', type: 'text' },
          { name: 'monthlyIncome', label: 'Monthly income', type: 'number' },
          { name: 'incomeType', label: 'Income type', type: 'select', options: ['Salary', 'Business', 'Professional', 'Other'] },
          { name: 'optionalIncome', label: 'Any optional income', type: 'text' },
          { name: 'salaryMode', label: 'Salary mode', type: 'select', options: ['Account transfer', 'Cash'] },
        ]
      }],
    },
    {
      id: 'co-applicant',
      title: 'Co-Applicant Details',
      sections: [{
        title: 'Co-applicant details',
        fields: [
          { name: 'coApplicantList', label: 'Co-applicant', type: 'repeatable-group', repeatable: true, fields: [
            { name: 'name', label: 'Name', type: 'text' },
            { name: 'mobile', label: 'Mobile no', type: 'tel' },
            { name: 'email', label: 'Email id', type: 'email' },
            { name: 'age', label: 'Age', type: 'number' },
            { name: 'motherName', label: 'Mother name', type: 'text' },
            { name: 'fatherName', label: 'Father name', type: 'text' },
            { name: 'spouseName', label: 'Husband/Wife', type: 'text' },
            { name: 'relationship', label: 'Relationship with applicant', type: 'text' },
            { name: 'monthlyIncome', label: 'Monthly income', type: 'number' },
            { name: 'incomeType', label: 'Income type', type: 'select', options: ['Salary', 'Business', 'Professional', 'Other'] },
            { name: 'optionalIncome', label: 'Any optional income', type: 'text' },
            { name: 'salaryMode', label: 'Salary mode', type: 'select', options: ['Account transfer', 'Cash'] },
          ] },
        ]
      }],
    },
    {
      id: 'family-income',
      title: 'Family Income Details',
      sections: [{
        title: 'Family income details',
        fields: [
          { name: 'familyMembers', label: 'Family members', type: 'repeatable-group', repeatable: true, fields: [
            { name: 'name', label: 'Name', type: 'text' },
            { name: 'relationship', label: 'Relationship', type: 'text' },
            { name: 'incomeType', label: 'Income type', type: 'select', options: ['Salary', 'Business', 'Professional', 'Other'] },
            { name: 'proof', label: 'Proof', type: 'file', fileKey: 'familyProof' },
            { name: 'age', label: 'Age', type: 'number' },
          ] },
        ]
      }],
    },
    {
      id: 'property',
      title: 'Property Details',
      sections: [{
        title: 'Property details',
        fields: [
          { name: 'propertyAddress', label: 'Property address', type: 'textarea' },
          { name: 'propertyType', label: 'Property type', type: 'text' },
          { name: 'kathaType', label: 'Katha type', type: 'text' },
          { name: 'propertyAge', label: 'Property age', type: 'number' },
          { name: 'builtUpArea', label: 'Built-up area', type: 'number' },
          { name: 'numberOfFloors', label: 'Number of floors', type: 'number' },
          { name: 'numberOfUnits', label: 'Number of units / houses', type: 'number' },
          { name: 'propertySrValue', label: 'Property SR value', type: 'number' },
          { name: 'propertyMarketValue', label: 'Property market value', type: 'number' },
          { name: 'ownershipDocumentType', label: 'Ownership document type', type: 'select', options: ['Sale deed', 'Kriya patra'] },
          { name: 'rentalIncome', label: 'Total rental income on building', type: 'number' },
        ]
      }],
    },
    {
      id: 'property-photos',
      title: 'Property Photos / Video',
      sections: [{
        title: 'Property photos / video',
        fields: [
          { name: 'frontPhoto', label: 'Front', type: 'file', fileKey: 'frontPhoto' },
          { name: 'rightPhoto', label: 'Right', type: 'file', fileKey: 'rightPhoto' },
          { name: 'leftPhoto', label: 'Left', type: 'file', fileKey: 'leftPhoto' },
          { name: 'backPhoto', label: 'Back', type: 'file', fileKey: 'backPhoto' },
          { name: 'roadPhoto', label: 'Road to home', type: 'file', fileKey: 'roadPhoto' },
        ]
      }],
    },
    {
      id: 'docs',
      title: 'Documents',
      sections: [{
        title: 'Required documents',
        fields: [
          { name: 'saleDeed', label: 'Sale deed', type: 'file', multiple: true, fileKey: 'saleDeed' },
          { name: 'motherDeed', label: 'Mother deed', type: 'file', multiple: true, fileKey: 'motherDeed' },
          { name: 'taxPaidReceipt', label: 'Tax paid receipt', type: 'file', multiple: true, fileKey: 'taxPaidReceipt' },
          { name: 'ec', label: 'EC', type: 'file', multiple: true, fileKey: 'ec' },
          { name: 'katha', label: 'Katha', type: 'file', multiple: true, fileKey: 'katha' },
        ]
      }],
    },
    {
      id: 'surroundings',
      title: 'Property Surroundings',
      sections: [{
        title: 'Surroundings check within 200 metres',
        fields: [
          { name: 'highTensionWire', label: 'High tension wire', type: 'radio', options: ['Yes', 'No'] },
          { name: 'highTensionDistance', label: 'Distance in metres', type: 'number', showIf: { field: 'highTensionWire', equals: 'Yes' } },
          { name: 'stormWaterDrain', label: 'Raja kaluve (storm-water drain)', type: 'radio', options: ['Yes', 'No'] },
          { name: 'stormWaterDistance', label: 'Distance in metres', type: 'number', showIf: { field: 'stormWaterDrain', equals: 'Yes' } },
          { name: 'drainage', label: 'Drainage', type: 'radio', options: ['Yes', 'No'] },
          { name: 'drainageDistance', label: 'Distance in metres', type: 'number', showIf: { field: 'drainage', equals: 'Yes' } },
          { name: 'railwayGate', label: 'Railway gate', type: 'radio', options: ['Yes', 'No'] },
          { name: 'railwayGateDistance', label: 'Distance in metres', type: 'number', showIf: { field: 'railwayGate', equals: 'Yes' } },
          { name: 'temple', label: 'Temple', type: 'radio', options: ['Yes', 'No'] },
          { name: 'templeDistance', label: 'Distance in metres', type: 'number', showIf: { field: 'temple', equals: 'Yes' } },
          { name: 'mosque', label: 'Mosque', type: 'radio', options: ['Yes', 'No'] },
          { name: 'mosqueDistance', label: 'Distance in metres', type: 'number', showIf: { field: 'mosque', equals: 'Yes' } },
          { name: 'samadhi', label: 'Samadhi', type: 'radio', options: ['Yes', 'No'] },
          { name: 'samadhiDistance', label: 'Distance in metres', type: 'number', showIf: { field: 'samadhi', equals: 'Yes' } },
          { name: 'lake', label: 'Lake', type: 'radio', options: ['Yes', 'No'] },
          { name: 'lakeDistance', label: 'Distance in metres', type: 'number', showIf: { field: 'lake', equals: 'Yes' } },
          { name: 'otherNearbyArea', label: 'Other nearby area', type: 'text' },
          { name: 'roadBelow10Feet', label: 'Road in front is below 10 feet?', type: 'radio', options: ['Yes', 'No'] },
        ]
      }],
    },
  ],
};

module.exports = {
  loanTypeMap: baseLoanTypeMap,
  financialYears,
  yearOptions,
  flows: { A: sharedFlowA, B: sharedFlowB, C: sharedFlowC },
  getFlowForLoanType: (loanType) => baseLoanTypeMap[loanType] || 'A',
  commonStartStep,
};

/**
 * Form Exemplars - High-quality example forms for pattern learning
 * These exemplars demonstrate intelligent field selection in real contexts
 */

export interface FormExemplar {
  id: string;
  name: string;
  industry: string;
  purpose: string;
  complexity: 'simple' | 'moderate' | 'complex';
  fields: ExemplarField[];
  designRationale: string;
  keyDecisions: string[];
}

export interface ExemplarField {
  label: string;
  type: string;
  options?: string[];
  required: boolean;
  reasoning: string;
}

/**
 * Curated form exemplars demonstrating intelligent field selection
 */
export const FORM_EXEMPLARS: FormExemplar[] = [
  {
    id: 'client-intake-accounting',
    name: 'Accounting Client Intake Form',
    industry: 'accounting',
    purpose: 'Onboard new accounting clients with comprehensive business information',
    complexity: 'complex',
    fields: [
      {
        label: 'Business Legal Name',
        type: 'text',
        required: true,
        reasoning: 'Official business name requires exact text entry, not selection from options'
      },
      {
        label: 'Business Structure',
        type: 'select',
        options: ['Sole Proprietorship', 'Partnership', 'LLC', 'S-Corp', 'C-Corp', 'Non-Profit'],
        required: true,
        reasoning: 'Limited set of legal entity types - dropdown provides guidance and ensures consistency'
      },
      {
        label: 'Industry',
        type: 'select',
        options: ['Technology', 'Healthcare', 'Retail', 'Manufacturing', 'Professional Services', 'Real Estate', 'Other'],
        required: true,
        reasoning: 'Industry classification from predefined categories for reporting purposes'
      },
      {
        label: 'Annual Revenue',
        type: 'currency',
        required: true,
        reasoning: 'Financial amount requires currency formatting and proper decimal handling'
      },
      {
        label: 'Number of Employees',
        type: 'number',
        required: true,
        reasoning: 'Count of people is a whole number, not decimal - number type appropriate'
      },
      {
        label: 'Fiscal Year End',
        type: 'date',
        required: true,
        reasoning: 'Specific date for tax and reporting purposes - date picker ensures valid dates'
      },
      {
        label: 'Services Needed',
        type: 'multi_select',
        options: ['Bookkeeping', 'Tax Preparation', 'Payroll', 'CFO Services', 'Audit Support', 'Financial Planning'],
        required: true,
        reasoning: 'Clients often need multiple services - multi_select allows selecting several items efficiently'
      },
      {
        label: 'Current Accounting Software',
        type: 'select',
        options: ['QuickBooks Online', 'QuickBooks Desktop', 'Xero', 'FreshBooks', 'Wave', 'None', 'Other'],
        required: false,
        reasoning: 'Single software platform used - dropdown from common options'
      },
      {
        label: 'Have you filed taxes in previous years?',
        type: 'radio',
        options: ['Yes', 'No'],
        required: true,
        reasoning: 'Binary yes/no question - radio buttons make both options immediately visible'
      },
      {
        label: 'Primary Contact Email',
        type: 'email',
        required: true,
        reasoning: 'Email field provides validation and mobile keyboard optimization'
      },
      {
        label: 'Primary Contact Phone',
        type: 'phone',
        required: true,
        reasoning: 'Phone type optimizes mobile keyboard and allows format handling'
      },
      {
        label: 'Business Address',
        type: 'address',
        required: true,
        reasoning: 'Complete address with structure (street/city/state/zip) better than freeform text'
      },
      {
        label: 'Additional Information or Special Requirements',
        type: 'textarea',
        required: false,
        reasoning: 'Open-ended details require multi-line text area, not single-line input'
      },
      {
        label: 'Engagement Letter',
        type: 'file_upload',
        required: false,
        reasoning: 'Document submission requires file upload capability'
      },
      {
        label: 'Authorized Signature',
        type: 'signature',
        required: true,
        reasoning: 'Legal engagement requires actual signature capture, not text field'
      }
    ],
    designRationale: 'This form balances comprehensive data collection with user experience. Field types are chosen to guide input, validate data, and reduce errors.',
    keyDecisions: [
      'Used select for business structure instead of text to ensure legal consistency',
      'Multi_select for services allows clients to request multiple services in one field',
      'Radio for yes/no makes binary choice immediately clear',
      'Address composite field ensures structured data over freeform text',
      'Signature field for legal requirement, not checkbox with typed name'
    ]
  },
  {
    id: 'event-registration',
    name: 'Conference Registration Form',
    industry: 'events',
    purpose: 'Register attendees for professional conference with session selection',
    complexity: 'moderate',
    fields: [
      {
        label: 'Full Name',
        type: 'name',
        required: true,
        reasoning: 'Formal event needs structured name (title/first/last) for badges and certificates'
      },
      {
        label: 'Email Address',
        type: 'email',
        required: true,
        reasoning: 'Email validation ensures we can send confirmation and updates'
      },
      {
        label: 'Company Name',
        type: 'text',
        required: false,
        reasoning: 'Freeform company name, not from predefined list'
      },
      {
        label: 'Job Title',
        type: 'text',
        required: false,
        reasoning: 'Open text allows any job title specification'
      },
      {
        label: 'Dietary Restrictions',
        type: 'multi_select',
        options: ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut Allergy', 'None'],
        required: true,
        reasoning: 'Attendees may have multiple restrictions - multi_select handles this efficiently'
      },
      {
        label: 'T-Shirt Size',
        type: 'select',
        options: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
        required: true,
        reasoning: 'One size selection from standard options - dropdown is clear and compact'
      },
      {
        label: 'Session Track Preference',
        type: 'select',
        options: ['Technical', 'Business', 'Design', 'Leadership'],
        required: true,
        reasoning: 'Attendee chooses primary track - single selection from categories'
      },
      {
        label: 'Is this your first conference?',
        type: 'radio',
        options: ['Yes', 'No'],
        required: true,
        reasoning: 'Simple yes/no - radio buttons show both options immediately'
      },
      {
        label: 'What do you hope to learn? (optional)',
        type: 'textarea',
        required: false,
        reasoning: 'Open-ended response needs multi-line text area for detailed answers'
      },
      {
        label: 'Emergency Contact Phone',
        type: 'phone',
        required: true,
        reasoning: 'Phone field ensures proper format and mobile keyboard'
      }
    ],
    designRationale: 'Event registration requires collecting diverse information efficiently while maintaining good UX. Field types are chosen for clarity and data quality.',
    keyDecisions: [
      'Name composite field for formal badge printing',
      'Multi_select for dietary restrictions as attendees may have multiple',
      'Select for t-shirt size - finite predefined options',
      'Radio for first-time attendance - binary visibility important',
      'Textarea for learning goals allows detailed responses'
    ]
  },
  {
    id: 'job-application',
    name: 'Job Application Form',
    industry: 'hr',
    purpose: 'Collect applicant information for employment consideration',
    complexity: 'complex',
    fields: [
      {
        label: 'Full Legal Name',
        type: 'name',
        required: true,
        reasoning: 'Legal name with structure required for employment records'
      },
      {
        label: 'Email Address',
        type: 'email',
        required: true,
        reasoning: 'Primary communication channel with validation'
      },
      {
        label: 'Phone Number',
        type: 'phone',
        required: true,
        reasoning: 'Phone contact with proper formatting'
      },
      {
        label: 'Current Address',
        type: 'address',
        required: true,
        reasoning: 'Structured address for background checks and records'
      },
      {
        label: 'Position Applying For',
        type: 'select',
        options: ['Software Engineer', 'Product Manager', 'Designer', 'Marketing Manager', 'Sales Representative'],
        required: true,
        reasoning: 'Application for specific open positions - dropdown shows available roles'
      },
      {
        label: 'Years of Experience',
        type: 'number',
        required: true,
        reasoning: 'Whole number of years - number field appropriate'
      },
      {
        label: 'Expected Salary',
        type: 'currency',
        required: false,
        reasoning: 'Monetary value requires currency formatting'
      },
      {
        label: 'Availability to Start',
        type: 'select',
        options: ['Immediately', 'Within 2 weeks', 'Within 1 month', 'More than 1 month'],
        required: true,
        reasoning: 'Timeframe selection from predefined options'
      },
      {
        label: 'Are you legally authorized to work in this country?',
        type: 'radio',
        options: ['Yes', 'No'],
        required: true,
        reasoning: 'Legal requirement - binary yes/no with immediate visibility'
      },
      {
        label: 'Have you ever been convicted of a felony?',
        type: 'radio',
        options: ['Yes', 'No'],
        required: true,
        reasoning: 'Legal screening question - radio shows both options clearly'
      },
      {
        label: 'Skills and Competencies',
        type: 'multi_select',
        options: ['JavaScript', 'Python', 'Project Management', 'Data Analysis', 'Customer Service', 'Sales', 'Design'],
        required: true,
        reasoning: 'Applicants typically have multiple skills - multi_select efficient for selection'
      },
      {
        label: 'Resume',
        type: 'file_upload',
        required: true,
        reasoning: 'Document submission essential for application review'
      },
      {
        label: 'Cover Letter',
        type: 'file_upload',
        required: false,
        reasoning: 'Optional document upload'
      },
      {
        label: 'LinkedIn Profile URL',
        type: 'url',
        required: false,
        reasoning: 'Website link with validation - url field ensures proper format'
      },
      {
        label: 'Why do you want to work here?',
        type: 'textarea',
        required: true,
        reasoning: 'Essay-style response requires multi-line text area'
      },
      {
        label: 'Additional Comments',
        type: 'textarea',
        required: false,
        reasoning: 'Optional detailed information needs text area'
      }
    ],
    designRationale: 'Employment application balances legal requirements, candidate screening, and user experience. Field types ensure data quality and compliance.',
    keyDecisions: [
      'Structured name and address for legal/HR compliance',
      'Radio for legal yes/no questions - clarity and visibility critical',
      'Multi_select for skills - candidates have multiple competencies',
      'File upload for resume/documents - not text fields',
      'URL field for LinkedIn ensures valid link format',
      'Textarea for essay questions allows detailed responses'
    ]
  },
  {
    id: 'customer-feedback',
    name: 'Customer Satisfaction Survey',
    industry: 'customer_service',
    purpose: 'Gather customer feedback on service experience',
    complexity: 'simple',
    fields: [
      {
        label: 'Overall Satisfaction',
        type: 'rating',
        required: true,
        reasoning: 'Star rating provides intuitive visual feedback mechanism'
      },
      {
        label: 'How likely are you to recommend us?',
        type: 'slider',
        required: true,
        reasoning: 'NPS-style question works well with visual slider (0-10 scale)'
      },
      {
        label: 'Which best describes your experience?',
        type: 'select',
        options: ['Excellent', 'Good', 'Average', 'Poor', 'Very Poor'],
        required: true,
        reasoning: 'Single choice from quality scale - dropdown keeps form compact'
      },
      {
        label: 'What did you like most? (Select all that apply)',
        type: 'multi_select',
        options: ['Product Quality', 'Customer Service', 'Pricing', 'Delivery Speed', 'Website Experience'],
        required: false,
        reasoning: 'Customers may appreciate multiple aspects - multi_select captures all positive points'
      },
      {
        label: 'Would you purchase from us again?',
        type: 'radio',
        options: ['Yes', 'No', 'Maybe'],
        required: true,
        reasoning: 'Three mutually exclusive options - radio makes all choices visible'
      },
      {
        label: 'Additional Comments',
        type: 'textarea',
        required: false,
        reasoning: 'Open feedback requires text area for detailed comments'
      },
      {
        label: 'Email (optional, if you\'d like us to follow up)',
        type: 'email',
        required: false,
        reasoning: 'Optional contact - email field validates format'
      }
    ],
    designRationale: 'Feedback survey uses varied field types to maintain engagement and capture different types of responses efficiently.',
    keyDecisions: [
      'Rating field for satisfaction - visual and intuitive',
      'Slider for NPS - familiar pattern for recommendation questions',
      'Multi_select for positive aspects - allows multiple selections',
      'Radio for yes/no/maybe - three-way choice with immediate visibility',
      'Textarea for open comments - allows detailed feedback'
    ]
  },
  {
    id: 'property-rental-application',
    name: 'Rental Property Application',
    industry: 'real_estate',
    purpose: 'Screen potential tenants for rental property',
    complexity: 'complex',
    fields: [
      {
        label: 'Full Legal Name',
        type: 'name',
        required: true,
        reasoning: 'Legal name required for lease agreement and background check'
      },
      {
        label: 'Date of Birth',
        type: 'date',
        required: true,
        reasoning: 'Specific date for age verification and background check'
      },
      {
        label: 'Current Address',
        type: 'address',
        required: true,
        reasoning: 'Structured current residence address'
      },
      {
        label: 'Email',
        type: 'email',
        required: true,
        reasoning: 'Contact email with validation'
      },
      {
        label: 'Phone',
        type: 'phone',
        required: true,
        reasoning: 'Contact phone with formatting'
      },
      {
        label: 'Employment Status',
        type: 'select',
        options: ['Employed Full-Time', 'Employed Part-Time', 'Self-Employed', 'Student', 'Retired', 'Unemployed'],
        required: true,
        reasoning: 'Employment category from predefined options for screening'
      },
      {
        label: 'Monthly Income',
        type: 'currency',
        required: true,
        reasoning: 'Income verification - currency field for proper formatting'
      },
      {
        label: 'Desired Move-In Date',
        type: 'date',
        required: true,
        reasoning: 'Specific date for planning and availability'
      },
      {
        label: 'Length of Lease Desired',
        type: 'select',
        options: ['6 months', '1 year', '2 years', 'Month-to-month'],
        required: true,
        reasoning: 'Lease term selection from standard options'
      },
      {
        label: 'Number of Occupants',
        type: 'number',
        required: true,
        reasoning: 'Count of people - whole number'
      },
      {
        label: 'Do you have pets?',
        type: 'radio',
        options: ['Yes', 'No'],
        required: true,
        reasoning: 'Important yes/no for pet policy - radio shows both options'
      },
      {
        label: 'Have you ever been evicted?',
        type: 'radio',
        options: ['Yes', 'No'],
        required: true,
        reasoning: 'Screening question - binary yes/no with visibility'
      },
      {
        label: 'References',
        type: 'textarea',
        required: true,
        reasoning: 'Multiple references with contact info - text area for structured list'
      },
      {
        label: 'Why are you moving?',
        type: 'textarea',
        required: false,
        reasoning: 'Open-ended explanation - text area for detailed answer'
      },
      {
        label: 'Proof of Income (recent pay stub or tax return)',
        type: 'file_upload',
        required: true,
        reasoning: 'Document verification requires file upload'
      },
      {
        label: 'Photo ID',
        type: 'file_upload',
        required: true,
        reasoning: 'Identity verification document'
      }
    ],
    designRationale: 'Rental application balances thorough screening with user experience. Field types ensure proper data collection for legal and financial assessment.',
    keyDecisions: [
      'Structured name and address for legal documents',
      'Date field for DOB and move-in ensures valid dates',
      'Currency for income verification with proper formatting',
      'Radio for yes/no screening questions - clarity important',
      'File uploads for verification documents',
      'Textarea for references allows structured list entry'
    ]
  }
];

/**
 * Find exemplars by industry
 */
export function getExemplarsByIndustry(industry: string): FormExemplar[] {
  return FORM_EXEMPLARS.filter(ex => ex.industry === industry);
}

/**
 * Find exemplars by complexity
 */
export function getExemplarsByComplexity(complexity: 'simple' | 'moderate' | 'complex'): FormExemplar[] {
  return FORM_EXEMPLARS.filter(ex => ex.complexity === complexity);
}

/**
 * Search exemplars by purpose or context
 */
export function searchExemplars(query: string): FormExemplar[] {
  const lowerQuery = query.toLowerCase();
  return FORM_EXEMPLARS.filter(ex => 
    ex.name.toLowerCase().includes(lowerQuery) ||
    ex.purpose.toLowerCase().includes(lowerQuery) ||
    ex.industry.toLowerCase().includes(lowerQuery) ||
    ex.keyDecisions.some(kd => kd.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get most relevant exemplar fields based on semantic similarity
 */
export function findRelevantExemplarFields(context: string): ExemplarField[] {
  const lowerContext = context.toLowerCase();
  const relevantFields: ExemplarField[] = [];
  
  for (const exemplar of FORM_EXEMPLARS) {
    for (const field of exemplar.fields) {
      if (
        field.label.toLowerCase().includes(lowerContext) ||
        field.reasoning.toLowerCase().includes(lowerContext) ||
        field.type.toLowerCase().includes(lowerContext)
      ) {
        relevantFields.push(field);
      }
    }
  }
  
  return relevantFields;
}

/**
 * Field Type Catalog - Comprehensive metadata for intelligent field selection
 * This catalog provides semantic information about field types without prescriptive rules
 */

export interface FieldTypeDefinition {
  type: string;
  category: string;
  description: string;
  semanticKeywords: string[];
  useCases: string[];
  uxConsiderations: string[];
  constraints?: string[];
  exampleLabels?: string[];
}

/**
 * Comprehensive field type catalog with semantic information
 * Used for retrieval-based intelligent field selection
 */
export const FIELD_CATALOG: FieldTypeDefinition[] = [
  // === Text Input Fields ===
  {
    type: 'text',
    category: 'text_input',
    description: 'Single-line text input for short strings',
    semanticKeywords: ['name', 'title', 'label', 'code', 'identifier', 'short text', 'single line'],
    useCases: [
      'Names, titles, or short identifiers',
      'Single words or brief phrases',
      'Codes, reference numbers, or IDs'
    ],
    uxConsiderations: [
      'Best for inputs under 100 characters',
      'Users expect single-line entry',
      'Not suitable for lengthy descriptions'
    ],
    exampleLabels: ['First Name', 'Company Name', 'Job Title', 'Reference Number']
  },
  {
    type: 'textarea',
    category: 'text_input',
    description: 'Multi-line text area for longer content',
    semanticKeywords: ['description', 'comments', 'notes', 'details', 'explanation', 'long text', 'paragraph'],
    useCases: [
      'Detailed descriptions or explanations',
      'Comments, feedback, or notes',
      'Multi-paragraph content'
    ],
    uxConsiderations: [
      'Signals expectation of longer input',
      'Allows line breaks and formatting',
      'Provides more visual space'
    ],
    exampleLabels: ['Description', 'Comments', 'Additional Notes', 'Project Details']
  },
  {
    type: 'email',
    category: 'text_input',
    description: 'Email address with built-in validation',
    semanticKeywords: ['email', 'e-mail', 'contact email', 'email address'],
    useCases: ['Email addresses for contact or authentication'],
    uxConsiderations: [
      'Provides email-specific keyboard on mobile',
      'Built-in format validation',
      'Standard @ symbol requirement'
    ],
    exampleLabels: ['Email Address', 'Contact Email', 'Business Email']
  },
  {
    type: 'phone',
    category: 'text_input',
    description: 'Phone number with format handling',
    semanticKeywords: ['phone', 'telephone', 'mobile', 'contact number', 'phone number'],
    useCases: ['Phone numbers for contact purposes'],
    uxConsiderations: [
      'Numeric keyboard on mobile devices',
      'May need country code handling',
      'Format varies by region'
    ],
    exampleLabels: ['Phone Number', 'Mobile Number', 'Contact Phone']
  },
  {
    type: 'url',
    category: 'text_input',
    description: 'Website URL with validation',
    semanticKeywords: ['url', 'website', 'link', 'web address', 'homepage'],
    useCases: ['Website addresses, social media links, portfolio URLs'],
    uxConsiderations: [
      'URL validation (http/https)',
      'Clickable in review/display mode'
    ],
    exampleLabels: ['Website', 'Portfolio URL', 'LinkedIn Profile']
  },

  // === Selection Fields ===
  {
    type: 'select',
    category: 'selection',
    description: 'Dropdown for choosing one option from a list',
    semanticKeywords: ['choose one', 'pick one', 'single choice', 'dropdown', 'select one', 'option'],
    useCases: [
      'Choosing one item from predefined options',
      'Category or type selection',
      'Status or state selection'
    ],
    uxConsiderations: [
      'Compact display for many options',
      'Clear when only one selection allowed',
      'Efficient for 5+ options'
    ],
    exampleLabels: ['Country', 'Department', 'Priority Level', 'Account Type']
  },
  {
    type: 'multi_select',
    category: 'selection',
    description: 'Dropdown allowing multiple selections',
    semanticKeywords: ['choose multiple', 'pick many', 'multiple choice', 'select multiple', 'multi-select'],
    useCases: [
      'Selecting multiple items from a list',
      'Tags, categories, or attributes',
      'Skills, interests, or preferences'
    ],
    uxConsiderations: [
      'Shows selected items as chips/tags',
      'User can select 0 to all options',
      'Better than multiple checkboxes for long lists'
    ],
    exampleLabels: ['Skills', 'Interests', 'Services Needed', 'Product Categories']
  },
  {
    type: 'radio',
    category: 'selection',
    description: 'Radio buttons for mutually exclusive choices',
    semanticKeywords: ['yes/no', 'true/false', 'either/or', 'radio button', 'one of', 'exclusive choice'],
    useCases: [
      'Binary choices (Yes/No, True/False)',
      'Small set of mutually exclusive options (2-5 items)',
      'When all options should be visible'
    ],
    uxConsiderations: [
      'All options visible without clicking',
      'Best for 2-5 options',
      'Clear mutual exclusivity'
    ],
    exampleLabels: ['Are you a US citizen?', 'Employment Status', 'Preferred Contact Method']
  },
  {
    type: 'checkbox',
    category: 'selection',
    description: 'Independent checkboxes for yes/no options',
    semanticKeywords: ['agree', 'consent', 'checkbox', 'tick', 'acknowledgment', 'multiple independent'],
    useCases: [
      'Independent yes/no choices',
      'Agreements or acknowledgments',
      'Small set of optional items (2-4)'
    ],
    uxConsiderations: [
      'Each checkbox is independent',
      'Suitable for consent/agreement flows',
      'Different from multi_select semantically'
    ],
    exampleLabels: ['I agree to terms', 'Subscribe to newsletter', 'Notifications Preferences']
  },

  // === Numeric Fields ===
  {
    type: 'number',
    category: 'numeric',
    description: 'Whole number input',
    semanticKeywords: ['number', 'integer', 'count', 'quantity', 'age', 'whole number'],
    useCases: [
      'Counts, quantities, or integers',
      'Age or year values',
      'Whole number measurements'
    ],
    uxConsiderations: [
      'Numeric keyboard on mobile',
      'Spinner controls for incrementing',
      'No decimal places'
    ],
    exampleLabels: ['Age', 'Quantity', 'Number of Employees', 'Year']
  },
  {
    type: 'decimal',
    category: 'numeric',
    description: 'Decimal number with precision',
    semanticKeywords: ['decimal', 'float', 'precise number', 'measurement'],
    useCases: [
      'Measurements requiring decimal precision',
      'Rates, ratios, or percentages as decimals',
      'Scientific or technical values'
    ],
    uxConsiderations: [
      'Allows decimal point entry',
      'Precision configuration needed',
      'Better than plain number for exact values'
    ],
    exampleLabels: ['Weight (kg)', 'Height (m)', 'Interest Rate']
  },
  {
    type: 'currency',
    category: 'numeric',
    description: 'Monetary amount with currency formatting',
    semanticKeywords: ['money', 'price', 'cost', 'amount', 'salary', 'revenue', 'currency', 'dollars'],
    useCases: [
      'Financial amounts and pricing',
      'Salaries, budgets, or revenue',
      'Any monetary value'
    ],
    uxConsiderations: [
      'Automatic currency symbol display',
      'Proper decimal handling (2 places)',
      'Regional formatting support'
    ],
    exampleLabels: ['Budget', 'Annual Revenue', 'Expected Salary', 'Product Price']
  },
  {
    type: 'percentage',
    category: 'numeric',
    description: 'Percentage value (0-100)',
    semanticKeywords: ['percent', 'percentage', '%', 'rate', 'ratio as percent'],
    useCases: [
      'Percentages, rates, or ratios',
      'Completion or progress values',
      'Discount or tax rates'
    ],
    uxConsiderations: [
      'Automatic % symbol',
      'Typically 0-100 range',
      'Clear percentage context'
    ],
    exampleLabels: ['Discount Rate', 'Completion %', 'Tax Rate', 'Ownership Share']
  },
  {
    type: 'rating',
    category: 'numeric',
    description: 'Star or numeric rating scale',
    semanticKeywords: ['rating', 'stars', 'score', 'satisfaction', 'quality'],
    useCases: [
      'Satisfaction or quality ratings',
      'Star-based reviews',
      'Scaled responses (1-5, 1-10)'
    ],
    uxConsiderations: [
      'Visual star or numeric display',
      'Clear scale indication',
      'Intuitive interaction'
    ],
    exampleLabels: ['Satisfaction Rating', 'Service Quality', 'Product Review']
  },
  {
    type: 'slider',
    category: 'numeric',
    description: 'Visual slider for range selection',
    semanticKeywords: ['slider', 'range', 'scale', 'level', 'intensity'],
    useCases: [
      'Subjective scales or levels',
      'Ranges or preferences',
      'Visual value selection'
    ],
    uxConsiderations: [
      'Visual, interactive experience',
      'Good for relative values',
      'May lack precision for exact numbers'
    ],
    exampleLabels: ['Experience Level', 'Budget Range', 'Priority Level']
  },

  // === Date and Time ===
  {
    type: 'date',
    category: 'datetime',
    description: 'Date picker (day/month/year)',
    semanticKeywords: ['date', 'day', 'birthday', 'deadline', 'start date', 'end date'],
    useCases: [
      'Specific dates (birthdays, deadlines)',
      'Date ranges (start/end dates)',
      'Event or milestone dates'
    ],
    uxConsiderations: [
      'Visual calendar picker',
      'Date validation and formatting',
      'Clear date display format'
    ],
    exampleLabels: ['Birth Date', 'Start Date', 'Deadline', 'Event Date']
  },
  {
    type: 'time',
    category: 'datetime',
    description: 'Time picker (hours/minutes)',
    semanticKeywords: ['time', 'hour', 'appointment time', 'schedule'],
    useCases: [
      'Specific times for appointments',
      'Scheduling or time-based events',
      'Operating hours'
    ],
    uxConsiderations: [
      'Time format (12/24 hour)',
      'Timezone considerations',
      'Clear AM/PM indication'
    ],
    exampleLabels: ['Appointment Time', 'Start Time', 'Preferred Call Time']
  },
  {
    type: 'datetime',
    category: 'datetime',
    description: 'Combined date and time picker',
    semanticKeywords: ['datetime', 'date and time', 'timestamp', 'scheduled for'],
    useCases: [
      'Precise moments requiring both date and time',
      'Scheduled events or appointments',
      'Timestamps'
    ],
    uxConsiderations: [
      'Combined date/time picker UI',
      'Timezone handling critical',
      'More complex than separate fields'
    ],
    exampleLabels: ['Meeting Scheduled For', 'Delivery Time', 'Deadline (Date & Time)']
  },

  // === Composite Fields ===
  {
    type: 'name',
    category: 'composite',
    description: 'Structured name with title, first, middle, last',
    semanticKeywords: ['full name', 'person name', 'complete name', 'name structure'],
    useCases: [
      'Formal name collection requiring structure',
      'Legal or official name requirements',
      'International name handling'
    ],
    uxConsiderations: [
      'Separate fields for each component',
      'Respects cultural name formats',
      'More formal than single text field'
    ],
    exampleLabels: ['Legal Name', 'Full Name', 'Primary Contact Name']
  },
  {
    type: 'address',
    category: 'composite',
    description: 'Structured address with street, city, state, zip',
    semanticKeywords: ['address', 'location', 'street address', 'mailing address', 'physical address'],
    useCases: [
      'Complete mailing or physical addresses',
      'Location-based information',
      'Shipping or billing addresses'
    ],
    uxConsiderations: [
      'Multiple fields for proper structure',
      'International format support',
      'Potential address validation'
    ],
    exampleLabels: ['Mailing Address', 'Business Address', 'Shipping Address']
  },

  // === Special Input Fields ===
  {
    type: 'file_upload',
    category: 'special',
    description: 'File upload with type restrictions',
    semanticKeywords: ['upload', 'file', 'document', 'attachment', 'image upload', 'pdf'],
    useCases: [
      'Document submission',
      'Image or photo uploads',
      'Supporting materials'
    ],
    uxConsiderations: [
      'File type and size restrictions',
      'Upload progress indication',
      'Preview or confirmation needed'
    ],
    exampleLabels: ['Resume', 'Supporting Documents', 'Profile Photo', 'Tax Documents']
  },
  {
    type: 'signature',
    category: 'special',
    description: 'Digital signature capture',
    semanticKeywords: ['signature', 'sign', 'esign', 'digital signature', 'authorization'],
    useCases: [
      'Legal agreements or contracts',
      'Authorization or consent',
      'Document signing'
    ],
    uxConsiderations: [
      'Touch or mouse-based drawing',
      'Clear indication of legal intent',
      'Permanent record requirement'
    ],
    exampleLabels: ['Client Signature', 'Agreement Signature', 'Authorization']
  },
  {
    type: 'image_choice',
    category: 'special',
    description: 'Selection using images instead of text',
    semanticKeywords: ['visual choice', 'image selection', 'picture choice', 'icon selection'],
    useCases: [
      'Visual product selection',
      'Icon or style choices',
      'Options better shown than described'
    ],
    uxConsiderations: [
      'Images must be clear and distinct',
      'Accessibility considerations',
      'Loading and display optimization'
    ],
    exampleLabels: ['Choose Design Style', 'Select Product', 'Preferred Layout']
  },
  {
    type: 'matrix_choice',
    category: 'special',
    description: 'Grid of questions with same response options',
    semanticKeywords: ['matrix', 'grid', 'table', 'multiple questions same scale'],
    useCases: [
      'Rating multiple items on same scale',
      'Survey questions with consistent responses',
      'Comparison grids'
    ],
    uxConsiderations: [
      'Efficient for related questions',
      'Can be overwhelming if too large',
      'Best with 3-10 rows'
    ],
    exampleLabels: ['Rate Our Services', 'Skill Assessment', 'Feature Preferences']
  },

  // === Media Capture ===
  {
    type: 'audio',
    category: 'media',
    description: 'Audio recording or upload',
    semanticKeywords: ['audio', 'voice', 'recording', 'sound', 'voice memo'],
    useCases: [
      'Voice memos or notes',
      'Audio testimonials',
      'Sound recordings'
    ],
    uxConsiderations: [
      'Recording controls needed',
      'File size considerations',
      'Playback preview'
    ],
    exampleLabels: ['Voice Note', 'Audio Feedback', 'Recording']
  },
  {
    type: 'video',
    category: 'media',
    description: 'Video recording or upload',
    semanticKeywords: ['video', 'recording', 'video upload', 'clip'],
    useCases: [
      'Video testimonials',
      'Video documentation',
      'Visual evidence or demos'
    ],
    uxConsiderations: [
      'Significant file sizes',
      'Recording duration limits',
      'Preview and playback'
    ],
    exampleLabels: ['Video Testimonial', 'Demo Video', 'Documentation']
  },
  {
    type: 'camera',
    category: 'media',
    description: 'Direct camera photo capture',
    semanticKeywords: ['camera', 'photo', 'picture', 'snapshot', 'take photo'],
    useCases: [
      'On-site photo capture',
      'Document photography',
      'Real-time image collection'
    ],
    uxConsiderations: [
      'Mobile device camera access',
      'Immediate photo capture',
      'Preview before submission'
    ],
    exampleLabels: ['Take Photo', 'Capture Image', 'Site Photo']
  },

  // === Calculated Fields ===
  {
    type: 'formula',
    category: 'calculated',
    description: 'Auto-calculated based on other fields',
    semanticKeywords: ['calculate', 'formula', 'computed', 'total', 'sum', 'automatic calculation'],
    useCases: [
      'Totals and subtotals',
      'Derived calculations',
      'Auto-computed values'
    ],
    uxConsiderations: [
      'Read-only display',
      'Updates automatically',
      'Formula transparency important'
    ],
    exampleLabels: ['Total Amount', 'Calculated Tax', 'Net Price']
  },
  {
    type: 'unique_id',
    category: 'calculated',
    description: 'Auto-incrementing unique identifier',
    semanticKeywords: ['id', 'identifier', 'unique', 'auto-increment', 'sequential'],
    useCases: [
      'Form submission tracking',
      'Sequential numbering',
      'Reference IDs'
    ],
    uxConsiderations: [
      'Auto-generated, read-only',
      'Sequential or pattern-based',
      'Visible to user for reference'
    ],
    exampleLabels: ['Submission ID', 'Ticket Number', 'Reference ID']
  },
  {
    type: 'random_id',
    category: 'calculated',
    description: 'Random unique identifier',
    semanticKeywords: ['random id', 'uuid', 'random code', 'unique code'],
    useCases: [
      'Anonymous identifiers',
      'Secure reference codes',
      'Non-sequential IDs'
    ],
    uxConsiderations: [
      'Auto-generated random value',
      'Non-predictable',
      'Secure for privacy'
    ],
    exampleLabels: ['Access Code', 'Unique Code', 'Anonymous ID']
  },

  // === Structural Elements ===
  {
    type: 'heading',
    category: 'structural',
    description: 'Section heading or title',
    semanticKeywords: ['heading', 'title', 'section title', 'header'],
    useCases: [
      'Organizing form into sections',
      'Visual hierarchy',
      'Grouping related fields'
    ],
    uxConsiderations: [
      'Not a data field',
      'Improves form navigation',
      'Visual separation'
    ],
    exampleLabels: ['Personal Information', 'Contact Details', 'Business Information']
  },
  {
    type: 'divider',
    category: 'structural',
    description: 'Visual separator line',
    semanticKeywords: ['divider', 'separator', 'line', 'break'],
    useCases: [
      'Visual separation between sections',
      'Improving form readability',
      'Creating visual breaks'
    ],
    uxConsiderations: [
      'Not a data field',
      'Pure visual element',
      'Improves scanning'
    ],
    exampleLabels: []
  },
  {
    type: 'page_break',
    category: 'structural',
    description: 'Multi-page form separator',
    semanticKeywords: ['page break', 'next page', 'multi-page', 'pagination'],
    useCases: [
      'Breaking long forms into pages',
      'Progressive disclosure',
      'Step-by-step workflows'
    ],
    uxConsiderations: [
      'Creates separate form pages',
      'Progress indication needed',
      'Back/forward navigation'
    ],
    exampleLabels: []
  },
  {
    type: 'terms',
    category: 'structural',
    description: 'Terms and conditions display with acceptance',
    semanticKeywords: ['terms', 'terms and conditions', 'legal', 'agreement', 'consent'],
    useCases: [
      'Legal agreements',
      'Privacy policies',
      'Terms acceptance'
    ],
    uxConsiderations: [
      'Scrollable content display',
      'Required checkbox acceptance',
      'Link to full terms'
    ],
    exampleLabels: ['Terms and Conditions', 'Privacy Policy Agreement']
  },
  {
    type: 'html',
    category: 'structural',
    description: 'Custom HTML content block',
    semanticKeywords: ['html', 'custom content', 'rich text', 'formatted content'],
    useCases: [
      'Custom formatting or styling',
      'Embedded content',
      'Rich text instructions'
    ],
    uxConsiderations: [
      'Advanced configuration',
      'Not for data collection',
      'Flexibility for unique needs'
    ],
    exampleLabels: []
  }
];

/**
 * Get field types by category
 */
export function getFieldTypesByCategory(category: string): FieldTypeDefinition[] {
  return FIELD_CATALOG.filter(f => f.category === category);
}

/**
 * Search field types by semantic keywords
 */
export function searchFieldTypes(query: string): FieldTypeDefinition[] {
  const lowerQuery = query.toLowerCase();
  return FIELD_CATALOG.filter(field => 
    field.semanticKeywords.some(kw => kw.includes(lowerQuery)) ||
    field.description.toLowerCase().includes(lowerQuery) ||
    field.useCases.some(uc => uc.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get all available field type names
 */
export function getAllFieldTypes(): string[] {
  return FIELD_CATALOG.map(f => f.type);
}

/**
 * Get field type definition
 */
export function getFieldTypeDefinition(type: string): FieldTypeDefinition | undefined {
  return FIELD_CATALOG.find(f => f.type === type);
}

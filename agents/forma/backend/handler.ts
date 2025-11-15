import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";
import { storage } from "../../../server/storage";
import { withLLMConfig, getLLMConfig } from "../../../server/middleware/agent-llm-middleware";
import { LLMService } from "../../../server/llm-service";
import { FileParserService } from "../../../server/file-parser-service";
import multer from "multer";
import * as pdfParse from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { insertFormTemplateSchema } from "../../../shared/schema";
import { registerAgentSessionRoutes } from "../../../server/agent-sessions";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface FormField {
  id: string;
  label: string;
  type: "text" | "email" | "number" | "date" | "checkbox" | "select" | "textarea";
  required: boolean;
  placeholder?: string;
  options?: string[];
  order: number;
}

interface FormState {
  name: string;
  description?: string;
  fields: FormField[];
  status: "building" | "complete";
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export const registerRoutes = (app: any) => {
  // Register session management routes
  registerAgentSessionRoutes(app, "forma");
  // Chat endpoint for conversational form building
  app.post("/api/agents/forma/chat", requireAuth, 
    withLLMConfig(async (req, res, llmConfig) => {
      try {
        const { message, history, currentForm } = req.body;

        // Initialize LLM service with LLM config from middleware
        const llmService = new LLMService(llmConfig);

      const systemPrompt = `You are Forma, an AI form builder assistant. You help users create comprehensive, production-ready forms through conversation.

**YOUR PRIMARY OBJECTIVE:**
Create COMPLETE forms with ALL necessary fields for the use case. Don't create minimal forms - create thorough, professional forms that collect all relevant information.

**YOUR JOB:**
1. Ask clarifying questions about the form they need and its business context
2. Understand ALL information they need to collect (not just what they mention)
3. Proactively suggest essential fields they might have missed
4. Build comprehensive form structures with appropriate field types
5. Return a complete JSON form structure with each response

**CRITICAL REQUIREMENTS:**
- Forms should have 8-15 fields minimum for most use cases (not 3-5)
- Include ALL standard fields for the form type (intake forms need contact info, demographics, preferences, etc.)
- Use appropriate field types for each data point
- Add helpful placeholders and validation hints
- For select fields, provide comprehensive option lists

**FORM STRUCTURE:**
{
  "name": "Form Name",
  "description": "Brief description",
  "fields": [
    {
      "id": "unique_id",
      "label": "Field Label",
      "type": "text|email|number|date|checkbox|select|textarea",
      "required": true|false,
      "placeholder": "Placeholder text",
      "options": ["Option 1", "Option 2"],  // Only for select fields
      "order": 0
    }
  ],
  "status": "building|complete"
}

**CONVERSATION FLOW:**
- When user says "create a client intake form", proactively suggest 10-15 standard fields (name, email, phone, company, address, etc.)
- When they mention specific fields, add those PLUS any related fields they might need
- Use appropriate field types (email for emails, number for numbers, etc.)
- Before marking complete, ask "Would you like to add fields for [X, Y, Z]?" to ensure comprehensive coverage
- Set status to "complete" only when user explicitly confirms form is done
- Status should be "building" while still working on it

**COMPREHENSIVE FIELD SUGGESTIONS:**
For different form types, proactively include ALL relevant fields:

- **Client Intake**: Full name, email, phone, company, address, business type, industry, annual revenue, number of employees, how they heard about you, preferred contact method
- **Tax Preparation**: Personal info (name, SSN, DOB, address), marital status, dependents, employment info, income sources, deductions, credits, filing preferences
- **Service Request**: Contact info, service type, urgency/priority, budget range, timeline, project description, preferred start date, special requirements
- **Employee Onboarding**: Personal details, emergency contact, tax withholding (W-4 info), direct deposit, benefits enrollment, policy acknowledgments
- **Lead Capture**: Contact info, company details, pain points, budget, decision timeline, current solution, decision-maker status

**FIELD COMPREHENSIVENESS EXAMPLES:**
Instead of just "Name, Email, Phone" for a client intake form, create:
- Full Name (text, required)
- Email Address (email, required)
- Phone Number (text, required, placeholder: "(555) 123-4567")
- Company Name (text)
- Job Title (text)
- Business Type (select with country-specific options)
- Industry (select with 15+ options)
- Company Size (select: 1-10, 11-50, 51-200, 201-500, 500+)
- Annual Revenue (select with ranges)
- Mailing Address (textarea)
- City (text)
- State/Province (select)
- ZIP/Postal Code (text)
- How Did You Hear About Us? (select)
- Preferred Contact Method (select: Email, Phone, Text)
- Special Requirements (textarea)

**FIELD TYPE MAPPING:**
- Name, Title, Description → text
- Email → email
- Phone → text (with appropriate placeholder)
- Age, Quantity, Amount → number
- Birthday, Date → date
- Yes/No questions → checkbox
- Multiple choice, Dropdowns, Pick one from list → select (MUST include options array)
- Long text, Comments, Notes → textarea

**CRITICAL - SELECT/DROPDOWN FIELDS:**
When user asks for dropdowns, selections, or multiple choice, you MUST use type "select" with an "options" array:
{
  "id": "unique_id",
  "label": "Business Type",
  "type": "select",
  "required": true,
  "placeholder": "Select business type",
  "options": ["Sole Proprietorship", "LLC", "Partnership", "Corporation"],
  "order": 0
}

**COUNTRY-AWARE BUSINESS TYPES:**
When creating business type dropdowns, ALWAYS ask the user what country/jurisdiction the form is for, then use appropriate options:
- **United States**: Sole Proprietorship, LLC, S-Corp, C-Corp, Partnership, Nonprofit
- **United Kingdom**: Sole Trader, Limited Company (Ltd), Limited Liability Partnership (LLP), Partnership, Public Limited Company (PLC)
- **Canada**: Sole Proprietorship, Partnership, Corporation, Cooperative
- **Australia**: Sole Trader, Partnership, Company (Pty Ltd), Trust
- **India**: Sole Proprietorship, Partnership, Limited Liability Partnership (LLP), Private Limited (Pvt Ltd), Public Limited, One Person Company (OPC)
- **European Union**: Sole Proprietorship, GmbH (Germany), SARL (France), SRL (Italy/Spain), BV (Netherlands), Ltd (varies)

If user doesn't specify country, ASK: "What country or jurisdiction is this form for? I'll provide the appropriate business type options."

Examples that need SELECT type:
- "Business type dropdown" → ASK for country first, then create select with country-specific options
- "State/Province selection" → Use options based on country
- "Tax filing status" → Country-specific tax statuses
- "Industry" → type: "select" with industry options
- "Choose your plan" → type: "select" with plan options

**RESPONSE FORMAT:**
Always respond with TWO parts separated by "---FORM_JSON---":
1. Your conversational response to the user
2. The current form JSON structure

Example:
Great! I've added an email field for you. What other information do you need to collect?
---FORM_JSON---
{"name":"Client Intake","description":"Collect client information","fields":[{"id":"abc123","label":"Email Address","type":"email","required":true,"order":0}],"status":"building"}

**IMPORTANT:**
- Always include the form JSON after your response
- Increment the order for each new field
- Generate unique IDs for fields
- Be conversational and helpful`;

      // Build conversation context from history
      let conversationContext = '';
      if (history && history.length > 0) {
        conversationContext = history
          .slice(-4) // Last 4 messages for context
          .map((msg: Message) => `${msg.role}: ${msg.content}`)
          .join('\n\n');
      }
      
      // Combine context with current message
      const fullPrompt = conversationContext 
        ? `${conversationContext}\n\nuser: ${message}`
        : message;

      // Call LLM service
      const fullResponse = await llmService.sendPrompt(fullPrompt, systemPrompt);

      // Parse the response to extract form JSON
      let responseText = fullResponse;
      let formUpdate: FormState | undefined = undefined;

      if (fullResponse.includes("---FORM_JSON---")) {
        const parts = fullResponse.split("---FORM_JSON---");
        responseText = parts[0].trim();
        
        try {
          const jsonPart = parts[1].trim();
          formUpdate = JSON.parse(jsonPart);
        } catch (e) {
          console.error("Failed to parse form JSON:", e);
        }
      }

      res.json({ 
        response: responseText,
        formUpdate: formUpdate || currentForm
      });
      
      } catch (error) {
        console.error("Error in Forma chat:", error);
        res.status(500).json({ 
          error: "Failed to process message",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    })
  );

  // Save form as template
  app.post("/api/agents/forma/save-form", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      // Validate scope parameter
      const templateScope = req.body.scope === "global" ? "global" : "organization";
      
      // Prepare template data with organization context
      const templateData = {
        ...req.body,
        scope: templateScope,
        organizationId: templateScope === "organization" ? req.user!.organizationId! : null,
        createdBy: req.user!.id,
        version: 1,
        status: "published",
        category: req.body.category || "custom",
        description: req.body.description || "",
        conditionalLogic: req.body.conditionalLogic || [],
        validationRules: req.body.validationRules || [],
        styling: req.body.styling || {}
      };

      // Validate using Zod schema
      const validationResult = insertFormTemplateSchema.safeParse(templateData);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid form template data",
          details: validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      // Save to form_templates table with validated data
      const template = await storage.createFormTemplate({
        ...validationResult.data,
        organizationId: templateScope === "organization" ? req.user!.organizationId! : null,
        createdBy: req.user!.id
      });

      res.json({ 
        success: true,
        message: "Form saved as template successfully",
        templateId: template.id
      });
      
    } catch (error) {
      console.error("Error saving form:", error);
      res.status(500).json({ 
        error: "Failed to save form",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Document upload and parsing endpoint with security limits
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
    fileFilter: (req, file, cb) => {
      const allowedMimes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/plain'
      ];
      
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PDF, DOCX, XLSX, and TXT files are allowed.'));
      }
    }
  });
  
  app.post("/api/agents/forma/upload-document", requireAuth, (req: AuthRequest, res: Response, next: any) => {
    upload.single("file")(req, res, async (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
          }
          return res.status(400).json({ error: `Upload error: ${err.message}` });
        }
        return res.status(400).json({ error: err.message || 'Invalid file upload' });
      }

      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        // Additional file size check
        if (req.file.size > 10 * 1024 * 1024) {
          return res.status(400).json({ error: "File too large. Maximum size is 10MB." });
        }

        // Get LLM configuration (required for form generation via AI)
        const llmConfig = await getLLMConfig({
          organizationId: req.user!.organizationId!,
          userId: req.user!.id
        });

        // Parse document using centralized FileParserService
        const parsed = await FileParserService.parseFile(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          llmConfig
        );

        // Warn if scanned PDF detected without LLM config
        if (parsed.isScannedPdf && !llmConfig) {
          console.warn(`[Forma] Scanned PDF upload without LLM config - OCR unavailable for org ${req.user!.organizationId}`);
        }

        const documentText = parsed.text;

        // Use AI to extract questions and create form
        const llmService = new LLMService(llmConfig);

      const systemPrompt = `You are Forma, an AI form builder. You analyze documents containing questions or data requirements and convert them into structured forms.

**YOUR TASK:**
1. Read the provided questionnaire/document
2. Extract all questions or data fields
3. Convert each question into an appropriate form field
4. Return a complete form structure

**FORM STRUCTURE:**
{
  "name": "Form Name (derived from document)",
  "description": "Brief description",
  "fields": [
    {
      "id": "unique_id",
      "label": "Question text",
      "type": "text|email|number|date|checkbox|select|textarea",
      "required": true|false,
      "placeholder": "Helpful placeholder",
      "options": ["Option 1", "Option 2"],  // Only for select fields
      "order": 0
    }
  ],
  "status": "complete"
}

**FIELD TYPE MAPPING:**
- Name, Address, Description → text
- Email address → email
- Phone, SSN, Tax ID → text
- Age, Quantity, Amount → number
- Date of birth, Dates → date
- Yes/No questions → checkbox
- Multiple choice questions → select (with options array)
- Long answers, Comments → textarea

**IMPORTANT:**
- Extract EVERY question/field from the document
- Use descriptive labels
- Infer field types from question context
- Set status to "complete"
- Generate unique IDs for each field

**RESPONSE FORMAT:**
Respond with TWO parts separated by "---FORM_JSON---":
1. A brief summary of what you found
2. The complete form JSON

Example:
I found 8 questions in your client intake questionnaire. I've created a form with all the fields.
---FORM_JSON---
{"name":"Client Intake","description":"Collect client information","fields":[...],"status":"complete"}`;

      const userPrompt = `Please analyze this document and create a form from it:

---DOCUMENT START---
${documentText}
---DOCUMENT END---

Extract all questions and convert them to form fields. Return the complete form structure.`;

      const fullResponse = await llmService.sendPrompt(userPrompt, systemPrompt);

      // Parse the response
      let responseText = fullResponse;
      let formUpdate: FormState | undefined = undefined;

      if (fullResponse.includes("---FORM_JSON---")) {
        const parts = fullResponse.split("---FORM_JSON---");
        responseText = parts[0].trim();
        
        try {
          const jsonPart = parts[1].trim();
          formUpdate = JSON.parse(jsonPart);
        } catch (e) {
          console.error("Failed to parse form JSON:", e);
          return res.status(500).json({ error: "Failed to parse AI response" });
        }
      }

      if (!formUpdate) {
        return res.status(500).json({ error: "AI did not return a valid form structure" });
      }

      res.json({ 
        response: responseText,
        formUpdate
      });
      
      } catch (error) {
        console.error("Error processing document:", error);
        res.status(500).json({ 
          error: "Failed to process document",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    });
  });
};

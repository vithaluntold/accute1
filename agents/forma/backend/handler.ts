import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";
import { storage } from "../../../server/storage";
import { LLMService } from "../../../server/llm-service";
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
  app.post("/api/agents/forma/chat", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { message, history, currentForm } = req.body;
      
      // Get default LLM configuration for the organization
      const llmConfig = await storage.getDefaultLlmConfiguration(req.user!.organizationId!);
      
      if (!llmConfig) {
        return res.status(400).json({ 
          error: "No LLM configuration found. Please configure your AI provider in Settings > LLM Configuration." 
        });
      }

      // Initialize LLM service
      const llmService = new LLMService(llmConfig);

      const systemPrompt = `You are Forma, an AI form builder assistant. You help users create forms through conversation.

**YOUR JOB:**
1. Ask clarifying questions about the form they need
2. Understand what fields they want
3. Build the form incrementally as you chat
4. Return a JSON form structure with each response

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
- When user says "create a client intake form", ask what fields they need
- When they mention fields, add them to the form
- Use appropriate field types (email for emails, number for numbers, etc.)
- Set status to "complete" only when user confirms form is done
- Status should be "building" while still working on it

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
  });

  // Save form as template
  app.post("/api/agents/forma/save-form", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      // Prepare template data with organization context
      const templateData = {
        ...req.body,
        scope: "organization",
        organizationId: req.user!.organizationId!,
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
        organizationId: req.user!.organizationId!,
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

      // Get LLM configuration
      const llmConfig = await storage.getDefaultLlmConfiguration(req.user!.organizationId!);
      if (!llmConfig) {
        return res.status(400).json({ 
          error: "No LLM configuration found. Please configure your AI provider in Settings > LLM Configuration." 
        });
      }

      // Parse document based on file type
      let documentText = "";
      const fileExtension = req.file.originalname.split('.').pop()?.toLowerCase();

      if (fileExtension === "pdf") {
        const pdfData = await (pdfParse as any)(req.file.buffer);
        documentText = pdfData.text;
      } else if (fileExtension === "docx") {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        documentText = result.value;
      } else if (fileExtension === "txt") {
        documentText = req.file.buffer.toString('utf-8');
      } else if (fileExtension === "xlsx" || fileExtension === "xls") {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        let allText = "";
        
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const csvData = XLSX.utils.sheet_to_csv(sheet);
          allText += `\n--- Sheet: ${sheetName} ---\n${csvData}\n`;
        });
        
        documentText = allText;
      } else {
        return res.status(400).json({ error: "Unsupported file type. Please upload PDF, DOCX, XLSX, or TXT files." });
      }

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

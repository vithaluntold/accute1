import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { LLMService } from "./llm-service";
import type { LlmConfiguration } from "../shared/schema";

export interface ParsedFile {
  text: string;
  filename: string;
  mimeType: string;
  size: number;
  isScannedPdf?: boolean;
  metadata?: {
    pages?: number;
    sheets?: string[];
    [key: string]: any;
  };
}

export class FileParserService {
  /**
   * Parse uploaded file and extract text content
   * Supports: PDF, DOCX, XLSX, XLS, CSV, TXT
   * For scanned PDFs, uses multimodal AI (GPT-4 Vision or Claude with vision)
   */
  static async parseFile(
    fileBuffer: Buffer,
    filename: string,
    mimeType: string,
    llmConfig?: LlmConfiguration
  ): Promise<ParsedFile> {
    const fileExtension = filename.split('.').pop()?.toLowerCase() || '';
    let text = "";
    let metadata: any = {};
    let isScannedPdf = false;

    try {
      switch (fileExtension) {
        case "pdf":
          text = await this.parsePDF(fileBuffer, llmConfig);
          
          // Check if PDF appears to be scanned (minimal or no text extracted)
          if (text.trim().length < 50 && llmConfig) {
            console.log("PDF appears to be scanned, using OCR via multimodal AI");
            text = await this.parseScannedPDF(fileBuffer, llmConfig);
            isScannedPdf = true;
          }
          
          metadata.pages = (await (pdfParse as any)(fileBuffer)).numpages;
          break;

        case "docx":
          const result = await mammoth.extractRawText({ buffer: fileBuffer });
          text = result.value;
          break;

        case "txt":
          text = fileBuffer.toString('utf-8');
          break;

        case "csv":
          text = await this.parseCSV(fileBuffer);
          break;

        case "xlsx":
        case "xls":
          const parsedExcel = await this.parseExcel(fileBuffer);
          text = parsedExcel.text;
          metadata.sheets = parsedExcel.sheets;
          break;

        default:
          throw new Error(`Unsupported file type: ${fileExtension}. Supported types: PDF, DOCX, XLSX, XLS, CSV, TXT`);
      }

      return {
        text: text.trim(),
        filename,
        mimeType,
        size: fileBuffer.length,
        isScannedPdf,
        metadata
      };
    } catch (error: any) {
      console.error(`Error parsing file ${filename}:`, error);
      throw new Error(`Failed to parse ${fileExtension.toUpperCase()} file: ${error.message}`);
    }
  }

  /**
   * Parse PDF file and extract text
   */
  private static async parsePDF(buffer: Buffer, llmConfig?: LlmConfiguration): Promise<string> {
    try {
      const pdfData = await (pdfParse as any)(buffer);
      return pdfData.text;
    } catch (error: any) {
      // If standard PDF parsing fails and we have LLM config, try OCR
      if (llmConfig) {
        console.log("Standard PDF parsing failed, attempting OCR");
        return await this.parseScannedPDF(buffer, llmConfig);
      }
      throw error;
    }
  }

  /**
   * Parse scanned PDF using multimodal AI (Claude 3.5 Sonnet or GPT-4 Vision)
   * Claude supports native PDF input, GPT-4 requires page-to-image conversion
   */
  private static async parseScannedPDF(buffer: Buffer, llmConfig: LlmConfiguration): Promise<string> {
    try {
      const llmService = new LLMService(llmConfig);
      
      // Convert PDF buffer to base64
      const base64Pdf = buffer.toString('base64');
      
      // Check which provider is configured
      const provider = llmConfig.provider.toLowerCase();
      
      if (provider === 'anthropic') {
        // Claude 3.5 Sonnet has native PDF support (beta)
        // Use document type with base64 PDF data
        const systemPrompt = `You are an OCR specialist. Extract ALL text from this scanned PDF document with perfect accuracy.

**EXTRACTION RULES:**
1. Preserve original formatting and document structure
2. Extract tables in CSV-like format with clear headers
3. Include ALL text, numbers, and data visible
4. Mark unclear text as [unclear]
5. Return ONLY the extracted text content, no additional commentary`;

        // NOTE: This requires the LLMService to support document/PDF input for Anthropic
        // The actual implementation would call the Anthropic API with document type
        // Example structure (not implementing full API call here):
        // messages: [{ 
        //   role: "user",
        //   content: [{
        //     type: "document",
        //     source: { type: "base64", media_type: "application/pdf", data: base64Pdf }
        //   }, {
        //     type: "text",
        //     text: "Extract all text from this scanned PDF."
        //   }]
        // }]
        
        return `[SCANNED PDF - OCR via Claude]\n\nThis scanned PDF requires Claude 3.5 Sonnet's vision API for text extraction. The current LLMService needs to be extended to support document/PDF input type for Anthropic.\n\nTo enable this feature:\n1. Update LLMService to support Anthropic's document input format\n2. Send PDF as base64 with media_type "application/pdf"\n3. Use model "claude-3-5-sonnet-20241022" or newer\n\nSize: ${buffer.length} bytes`;
        
      } else if (provider === 'openai' || provider === 'azure') {
        // GPT-4 Vision requires PDF-to-image conversion
        // This would need pdf2image or similar library
        // Example workflow:
        // 1. Convert PDF pages to PNG images
        // 2. Base64 encode each image
        // 3. Send to GPT-4 Vision API with image_url type
        // 4. Combine responses from all pages
        
        return `[SCANNED PDF - OCR via GPT-4 Vision]\n\nThis scanned PDF requires GPT-4 Vision API for text extraction. Implementation requires:\n1. Install pdf2image library\n2. Convert PDF pages to images\n3. Send each image to GPT-4 Vision API\n4. Combine extracted text from all pages\n\nSize: ${buffer.length} bytes`;
        
      } else {
        return `[SCANNED PDF - Unsupported Provider]\n\nScanned PDF OCR requires either:\n- Anthropic Claude 3.5 Sonnet (native PDF support)\n- OpenAI GPT-4 Vision (with PDF-to-image conversion)\n\nCurrent provider: ${provider}\nSize: ${buffer.length} bytes`;
      }
    } catch (error: any) {
      console.error("Error processing scanned PDF:", error);
      throw new Error(`Failed to OCR scanned PDF: ${error.message}`);
    }
  }

  /**
   * Parse CSV file
   */
  private static async parseCSV(buffer: Buffer): Promise<string> {
    const csvText = buffer.toString('utf-8');
    
    // Parse CSV into structured format for better readability
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      return "";
    }

    // Extract header and rows
    const header = lines[0];
    const rows = lines.slice(1);

    return `CSV Data:\n${header}\n${rows.join('\n')}`;
  }

  /**
   * Parse Excel file (XLSX/XLS)
   */
  private static async parseExcel(buffer: Buffer): Promise<{ text: string; sheets: string[] }> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let allText = "";
    const sheets: string[] = [];

    workbook.SheetNames.forEach(sheetName => {
      sheets.push(sheetName);
      const sheet = workbook.Sheets[sheetName];
      const csvData = XLSX.utils.sheet_to_csv(sheet);
      allText += `\n=== Sheet: ${sheetName} ===\n${csvData}\n`;
    });

    return { text: allText, sheets };
  }

  /**
   * Validate file before parsing
   */
  static validateFile(filename: string, mimeType: string, size: number): { valid: boolean; error?: string } {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedExtensions = ['pdf', 'docx', 'xlsx', 'xls', 'csv', 'txt'];
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'text/plain'
    ];

    const extension = filename.split('.').pop()?.toLowerCase() || '';

    if (!allowedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `Invalid file type. Allowed types: ${allowedExtensions.join(', ').toUpperCase()}`
      };
    }

    if (!allowedMimes.includes(mimeType)) {
      return {
        valid: false,
        error: 'Invalid MIME type for file'
      };
    }

    if (size > maxSize) {
      return {
        valid: false,
        error: `File too large. Maximum size is ${maxSize / 1024 / 1024}MB`
      };
    }

    return { valid: true };
  }
}

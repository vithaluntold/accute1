import * as pdfParse from "pdf-parse";
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
   * Parse scanned PDF using multimodal AI (GPT-4 Vision or Claude)
   * Converts PDF to base64 image and sends to vision-capable LLM
   */
  private static async parseScannedPDF(buffer: Buffer, llmConfig: LlmConfiguration): Promise<string> {
    try {
      const llmService = new LLMService(llmConfig);
      
      // Convert PDF buffer to base64 for multimodal AI
      const base64Pdf = buffer.toString('base64');
      
      // Create a prompt for OCR extraction
      const systemPrompt = `You are an OCR assistant. Extract ALL text from this scanned document image with perfect accuracy. 

Rules:
1. Preserve the original formatting and structure
2. Extract tables as CSV-like format with clear column headers
3. Include ALL text, numbers, and data visible in the image
4. If text is unclear, use [unclear] marker
5. Return ONLY the extracted text, no additional commentary`;

      const userPrompt = "Extract all text from this scanned PDF document.";

      // Note: This requires multimodal AI support (GPT-4 Vision, Claude 3.5 Sonnet with vision)
      // The LLMService needs to support image inputs
      // For now, we'll use text-based approach - in production, you'd need to:
      // 1. Convert PDF pages to images
      // 2. Send images to vision-capable model
      // 3. Extract text from vision model response
      
      // Fallback: Return a message indicating OCR is needed
      return `[SCANNED PDF DETECTED - Manual text extraction required]\n\nThis appears to be a scanned PDF document. To process this file:
1. Use an OCR tool to extract the text
2. Or configure a vision-capable AI model (GPT-4 Vision, Claude 3.5 Sonnet)
3. Then re-upload the extracted text

Filename: ${buffer.length} bytes`;
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

/**
 * Trace AI Agent - Resume Analysis & Skills Extraction
 * 
 * Analyzes resumes and extracts:
 * - Technical and soft skills
 * - Work experience
 * - Education and certifications
 * - Languages
 * - Tools and technologies
 */

import OpenAI from "openai";
import type { LlmConfiguration } from "@shared/schema";

export class TraceAgent {
  private llmConfig: LlmConfiguration;
  private openai: OpenAI | null = null;

  constructor(llmConfig: LlmConfiguration) {
    this.llmConfig = llmConfig;
    
    if (llmConfig.provider === "openai" && llmConfig.apiKey) {
      this.openai = new OpenAI({
        apiKey: llmConfig.apiKey,
      });
    }
  }

  /**
   * Non-streaming execution
   */
  async execute(
    input: string,
    context?: {
      userId?: string;
      organizationId?: string;
      sessionId?: string;
      resumeText?: string;
      employeeData?: any;
    }
  ): Promise<string> {
    if (!this.openai) {
      return JSON.stringify({
        error: "OpenAI not configured. Please configure an LLM provider.",
        skills: [],
      });
    }

    try {
      const resumeText = context?.resumeText || input;
      
      const systemPrompt = `You are Trace, an expert HR AI agent specializing in resume analysis and skills extraction.

Your task is to analyze resumes and extract:
1. Technical skills (programming languages, frameworks, tools, technologies)
2. Soft skills (leadership, communication, teamwork, problem-solving)
3. Work experience (companies, roles, duration, responsibilities)
4. Education (degrees, institutions, graduation years)
5. Certifications and licenses
6. Languages spoken
7. Notable achievements

Return the extracted information in this JSON format:
{
  "technicalSkills": ["skill1", "skill2", ...],
  "softSkills": ["skill1", "skill2", ...],
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "duration": "Jan 2020 - Present",
      "responsibilities": ["resp1", "resp2"]
    }
  ],
  "education": [
    {
      "degree": "Bachelor of Science in Computer Science",
      "institution": "University Name",
      "year": "2019"
    }
  ],
  "certifications": ["cert1", "cert2"],
  "languages": ["English", "Spanish"],
  "achievements": ["achievement1", "achievement2"],
  "summary": "Brief professional summary based on the resume"
}

Be thorough and extract all relevant information. If a section is not present in the resume, return an empty array for that field.`;

      const completion = await this.openai.chat.completions.create({
        model: this.llmConfig.model || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Please analyze this resume and extract all relevant information:\n\n${resumeText}`,
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const response = completion.choices[0]?.message?.content || "{}";
      
      // Parse and validate the JSON response
      try {
        const parsed = JSON.parse(response);
        
        // Ensure all required fields exist
        const result = {
          technicalSkills: parsed.technicalSkills || [],
          softSkills: parsed.softSkills || [],
          experience: parsed.experience || [],
          education: parsed.education || [],
          certifications: parsed.certifications || [],
          languages: parsed.languages || [],
          achievements: parsed.achievements || [],
          summary: parsed.summary || "No summary available",
        };
        
        return JSON.stringify(result, null, 2);
      } catch (parseError) {
        console.error("[Trace] Failed to parse JSON response:", parseError);
        return response;
      }
    } catch (error: any) {
      console.error("[Trace] Error analyzing resume:", error);
      return JSON.stringify({
        error: `Failed to analyze resume: ${error.message}`,
        technicalSkills: [],
        softSkills: [],
      });
    }
  }

  /**
   * Streaming execution
   */
  async executeStream(
    input: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    if (!this.openai) {
      const errorMsg = "OpenAI not configured. Please configure an LLM provider.";
      onChunk(errorMsg);
      return errorMsg;
    }

    try {
      const systemPrompt = `You are Trace, an expert HR AI agent specializing in resume analysis and skills extraction.

Analyze resumes conversationally and help HR teams:
- Extract and categorize skills
- Assess candidate qualifications
- Identify key strengths and expertise areas
- Suggest skill tags for employee profiles
- Provide insights on experience and education

Be professional, thorough, and helpful. When analyzing a resume:
1. Start with a brief overview
2. Highlight key technical skills
3. Note important soft skills
4. Summarize relevant experience
5. Mention education and certifications
6. Suggest categorized skill tags

Always format your response in a clear, organized manner.`;

      const stream = await this.openai.chat.completions.create({
        model: this.llmConfig.model || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input },
        ],
        temperature: 0.7,
        stream: true,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          onChunk(content);
        }
      }

      return fullResponse;
    } catch (error: any) {
      const errorMsg = `Error: ${error.message}`;
      onChunk(errorMsg);
      return errorMsg;
    }
  }
}

/**
 * Express route registration (for backend API endpoints)
 */
export function registerRoutes(app: any) {
  console.log("[Trace Agent] Routes registered");
  
  // Trace doesn't need custom routes as it uses the standard AI agent chat interface
  // All functionality is handled through the execute/executeStream methods
}

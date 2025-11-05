/**
 * Retrieval Service for Forma RAG Architecture
 * Provides semantic search over field catalog and form exemplars
 */

import { FIELD_CATALOG, type FieldTypeDefinition, searchFieldTypes } from './field-catalog';
import { FORM_EXEMPLARS, type FormExemplar, type ExemplarField, searchExemplars, findRelevantExemplarFields } from './form-exemplars';

export interface RetrievalContext {
  userQuery: string;
  organizationIndustry?: string;
  organizationContext?: string;
}

export interface RetrievalResult {
  relevantFieldTypes: FieldTypeDefinition[];
  relevantExemplars: FormExemplar[];
  relevantExemplarFields: ExemplarField[];
  semanticGuidance: string;
}

/**
 * Calculate semantic similarity score between query and text
 * Simple keyword-based similarity for now (can be enhanced with embeddings later)
 */
function calculateSimilarity(query: string, text: string): number {
  const queryTokens = query.toLowerCase().split(/\s+/);
  const textLower = text.toLowerCase();
  
  let score = 0;
  for (const token of queryTokens) {
    if (textLower.includes(token)) {
      score += 1;
    }
  }
  
  // Normalize by query length
  return score / queryTokens.length;
}

/**
 * Rank items by semantic similarity to query
 */
function rankBySimilarity<T extends { description?: string; purpose?: string; reasoning?: string }>(
  items: T[],
  query: string,
  textExtractor: (item: T) => string
): T[] {
  const scored = items.map(item => ({
    item,
    score: calculateSimilarity(query, textExtractor(item))
  }));
  
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.item);
}

/**
 * Main retrieval function - finds relevant context for form building
 */
export function retrieveRelevantContext(context: RetrievalContext): RetrievalResult {
  const { userQuery, organizationIndustry, organizationContext } = context;
  
  // 1. Search field types by keywords
  const keywordMatchedFields = searchFieldTypes(userQuery);
  
  // 2. Rank all field types by semantic similarity
  const rankedFields = rankBySimilarity(
    FIELD_CATALOG,
    userQuery,
    field => `${field.description} ${field.semanticKeywords.join(' ')} ${field.useCases.join(' ')}`
  );
  
  // Combine and deduplicate
  const fieldTypeMap = new Map<string, FieldTypeDefinition>();
  [...keywordMatchedFields, ...rankedFields].forEach(f => {
    if (!fieldTypeMap.has(f.type)) {
      fieldTypeMap.set(f.type, f);
    }
  });
  const relevantFieldTypes = Array.from(fieldTypeMap.values()).slice(0, 10);
  
  // 3. Find relevant exemplars by industry first
  let relevantExemplars: FormExemplar[] = [];
  if (organizationIndustry) {
    relevantExemplars = FORM_EXEMPLARS.filter(ex => ex.industry === organizationIndustry);
  }
  
  // Add general search results
  const searchedExemplars = searchExemplars(userQuery);
  relevantExemplars = [...relevantExemplars, ...searchedExemplars];
  
  // Deduplicate and limit
  const exemplarMap = new Map<string, FormExemplar>();
  relevantExemplars.forEach(ex => {
    if (!exemplarMap.has(ex.id)) {
      exemplarMap.set(ex.id, ex);
    }
  });
  relevantExemplars = Array.from(exemplarMap.values()).slice(0, 3);
  
  // 4. Find relevant exemplar fields
  const relevantExemplarFields = findRelevantExemplarFields(userQuery).slice(0, 8);
  
  // 5. Generate semantic guidance based on context
  const semanticGuidance = generateSemanticGuidance(userQuery, organizationIndustry, organizationContext);
  
  return {
    relevantFieldTypes,
    relevantExemplars,
    relevantExemplarFields,
    semanticGuidance
  };
}

/**
 * Generate contextual guidance for form building
 */
function generateSemanticGuidance(
  query: string,
  industry?: string,
  orgContext?: string
): string {
  let guidance = 'Form Design Principles:\n';
  
  // Industry-specific guidance
  if (industry === 'accounting') {
    guidance += '- Accounting forms require precise financial data collection\n';
    guidance += '- Use currency fields for monetary amounts\n';
    guidance += '- Consider audit trails and compliance requirements\n';
  } else if (industry === 'healthcare') {
    guidance += '- Healthcare forms must prioritize privacy and HIPAA compliance\n';
    guidance += '- Use structured fields for consistent medical data\n';
    guidance += '- Consider sensitivity of health information\n';
  } else if (industry === 'legal') {
    guidance += '- Legal forms require precise language and signatures\n';
    guidance += '- Use signature fields for legal agreements\n';
    guidance += '- Consider evidence and documentation requirements\n';
  }
  
  // General UX principles
  guidance += '\nGeneral UX Principles:\n';
  guidance += '- Choose field types that guide users and reduce errors\n';
  guidance += '- Use dropdowns/select when options are predefined and limited\n';
  guidance += '- Use multi_select when users may need multiple options\n';
  guidance += '- Use radio buttons when all options should be immediately visible (2-5 options)\n';
  guidance += '- Use text areas for open-ended responses, not single-line inputs\n';
  guidance += '- Match field types to data semantics (email for emails, currency for money, etc.)\n';
  
  return guidance;
}

/**
 * Extract field type recommendations from retrieved context
 */
export function extractFieldTypeRecommendations(retrievalResult: RetrievalResult): string {
  const { relevantFieldTypes, relevantExemplarFields } = retrievalResult;
  
  let recommendations = 'Available Field Types:\n\n';
  
  // Show top relevant field types
  relevantFieldTypes.slice(0, 8).forEach(fieldType => {
    recommendations += `**${fieldType.type}** (${fieldType.category})\n`;
    recommendations += `  ${fieldType.description}\n`;
    recommendations += `  Use when: ${fieldType.useCases[0]}\n\n`;
  });
  
  if (relevantExemplarFields.length > 0) {
    recommendations += '\nExample Field Decisions:\n\n';
    relevantExemplarFields.slice(0, 5).forEach(field => {
      recommendations += `• "${field.label}" → ${field.type}\n`;
      recommendations += `  Reasoning: ${field.reasoning}\n\n`;
    });
  }
  
  return recommendations;
}

/**
 * Get full field catalog for tool access
 */
export function getFullFieldCatalog(): FieldTypeDefinition[] {
  return FIELD_CATALOG;
}

/**
 * Get field type by name
 */
export function getFieldType(typeName: string): FieldTypeDefinition | undefined {
  return FIELD_CATALOG.find(f => f.type === typeName);
}

/**
 * Get exemplars for specific industry
 */
export function getIndustryExemplars(industry: string): FormExemplar[] {
  return FORM_EXEMPLARS.filter(ex => ex.industry === industry);
}

/**
 * Get all available field type names (for tool responses)
 */
export function getAllAvailableFieldTypes(): string[] {
  return FIELD_CATALOG.map(f => f.type);
}

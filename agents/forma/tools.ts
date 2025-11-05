/**
 * Forma AI Agent Tools
 * These tools allow Forma to dynamically query field catalog and exemplars
 */

import { 
  getFullFieldCatalog, 
  getFieldType, 
  getAllAvailableFieldTypes,
  getIndustryExemplars,
  retrieveRelevantContext,
  type RetrievalContext
} from './retrieval-service';

export interface FormaTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  execute: (params: any) => any;
}

/**
 * Tool: Get all available field types
 */
export const getAvailableFieldTypesTool: FormaTool = {
  name: 'get_available_field_types',
  description: 'Returns a list of all available field types that can be used in forms',
  parameters: {
    type: 'object',
    properties: {},
    required: []
  },
  execute: () => {
    const fieldTypes = getAllAvailableFieldTypes();
    return {
      fieldTypes,
      count: fieldTypes.length,
      message: `${fieldTypes.length} field types available: ${fieldTypes.join(', ')}`
    };
  }
};

/**
 * Tool: Get field type details
 */
export const getFieldTypeDetailsTool: FormaTool = {
  name: 'get_field_type_details',
  description: 'Get detailed information about a specific field type including description, use cases, and UX considerations',
  parameters: {
    type: 'object',
    properties: {
      fieldType: {
        type: 'string',
        description: 'The name of the field type to get details for (e.g., "select", "multi_select", "radio")'
      }
    },
    required: ['fieldType']
  },
  execute: (params: { fieldType: string }) => {
    const fieldTypeDef = getFieldType(params.fieldType);
    if (!fieldTypeDef) {
      return {
        error: `Field type "${params.fieldType}" not found`,
        availableTypes: getAllAvailableFieldTypes()
      };
    }
    return fieldTypeDef;
  }
};

/**
 * Tool: Search field catalog
 */
export const searchFieldCatalogTool: FormaTool = {
  name: 'search_field_catalog',
  description: 'Search the field catalog to find appropriate field types based on what data needs to be collected',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Description of the data to be collected (e.g., "email address", "choose one option", "multiple selections")'
      },
      industry: {
        type: 'string',
        description: 'Optional industry context (e.g., "accounting", "healthcare", "legal")'
      }
    },
    required: ['query']
  },
  execute: (params: { query: string; industry?: string }) => {
    const retrievalContext: RetrievalContext = {
      userQuery: params.query,
      organizationIndustry: params.industry
    };
    const result = retrieveRelevantContext(retrievalContext);
    
    return {
      relevantFieldTypes: result.relevantFieldTypes.slice(0, 5).map(f => ({
        type: f.type,
        description: f.description,
        useCases: f.useCases,
        uxConsiderations: f.uxConsiderations
      })),
      guidance: result.semanticGuidance,
      exampleFields: result.relevantExemplarFields.slice(0, 3).map(f => ({
        label: f.label,
        type: f.type,
        reasoning: f.reasoning
      }))
    };
  }
};

/**
 * Tool: Get industry exemplars
 */
export const getIndustryExemplarsTool: FormaTool = {
  name: 'get_industry_exemplars',
  description: 'Get example forms from a specific industry to learn patterns and best practices',
  parameters: {
    type: 'object',
    properties: {
      industry: {
        type: 'string',
        description: 'Industry to get examples for (e.g., "accounting", "healthcare", "hr", "events")'
      }
    },
    required: ['industry']
  },
  execute: (params: { industry: string }) => {
    const exemplars = getIndustryExemplars(params.industry);
    
    return {
      industry: params.industry,
      exemplarCount: exemplars.length,
      exemplars: exemplars.map(ex => ({
        name: ex.name,
        purpose: ex.purpose,
        complexity: ex.complexity,
        keyDecisions: ex.keyDecisions,
        sampleFields: ex.fields.slice(0, 5).map(f => ({
          label: f.label,
          type: f.type,
          reasoning: f.reasoning
        }))
      }))
    };
  }
};

/**
 * Tool: Get full field catalog
 */
export const getFullFieldCatalogTool: FormaTool = {
  name: 'get_full_field_catalog',
  description: 'Get the complete field type catalog with all available types, descriptions, and metadata',
  parameters: {
    type: 'object',
    properties: {},
    required: []
  },
  execute: () => {
    return {
      catalog: getFullFieldCatalog(),
      totalTypes: getFullFieldCatalog().length
    };
  }
};

/**
 * All Forma tools
 */
export const FORMA_TOOLS: FormaTool[] = [
  getAvailableFieldTypesTool,
  getFieldTypeDetailsTool,
  searchFieldCatalogTool,
  getIndustryExemplarsTool,
  getFullFieldCatalogTool
];

/**
 * Get tool by name
 */
export function getFormaTool(name: string): FormaTool | undefined {
  return FORMA_TOOLS.find(tool => tool.name === name);
}

/**
 * Execute a tool call
 */
export function executeFormaTool(toolName: string, params: any): any {
  const tool = getFormaTool(toolName);
  if (!tool) {
    throw new Error(`Tool "${toolName}" not found`);
  }
  return tool.execute(params);
}

/**
 * Get tools in format suitable for LLM function calling
 */
export function getFormaToolsForLLM() {
  return FORMA_TOOLS.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}

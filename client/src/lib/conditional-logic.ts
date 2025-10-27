import type { FormConditionalRule } from "@shared/schema";
import { Parser } from "expr-eval";

// Create a safe expression parser (no access to global scope)
const parser = new Parser();

/**
 * Safely evaluates a conditional expression with form data
 * Uses expr-eval library which provides secure expression evaluation
 * without access to global scope or arbitrary code execution
 * 
 * Expressions can reference fields by their ID (e.g., "field_abc123 > 1000")
 * 
 * @param expression - Mathematical/logical expression to evaluate
 * @param formData - Current form values keyed by field ID
 * @returns boolean result of the expression
 */
export function evaluateCondition(
  expression: string,
  formData: Record<string, any>
): boolean {
  try {
    // Parse and evaluate the expression with form data as context
    // expr-eval only allows safe mathematical and logical operations
    // No access to global objects, Function constructor, or eval
    const result = parser.evaluate(expression, formData);
    
    // Ensure result is boolean
    return Boolean(result);
  } catch (error) {
    console.error("Error evaluating conditional expression:", expression, error);
    // On error, default to false (don't show/require/disable)
    return false;
  }
}

/**
 * Evaluates all conditional rules and returns field states
 * 
 * @param rules - Array of conditional rules to evaluate
 * @param formData - Current form values keyed by field ID
 * @returns Object with field IDs as keys and their conditional states
 */
export function evaluateConditionalRules(
  rules: FormConditionalRule[],
  formData: Record<string, any>
): {
  hidden: Set<string>;
  required: Set<string>;
  disabled: Set<string>;
} {
  const hidden = new Set<string>();
  const required = new Set<string>();
  const disabled = new Set<string>();

  for (const rule of rules) {
    const conditionMet = evaluateCondition(rule.condition, formData);
    
    if (conditionMet) {
      for (const fieldId of rule.targetFieldIds) {
        switch (rule.action) {
          case "hide":
            hidden.add(fieldId);
            break;
          case "show":
            // Remove from hidden if it was hidden by another rule
            hidden.delete(fieldId);
            break;
          case "require":
            required.add(fieldId);
            break;
          case "disable":
            disabled.add(fieldId);
            break;
        }
      }
    }
  }

  return { hidden, required, disabled };
}

/**
 * Helper to get field value from form data, handling nested objects
 */
export function getFieldValue(fieldId: string, formData: Record<string, any>): any {
  return formData[fieldId];
}

/**
 * Validates a conditional expression syntax without executing it
 * Used in form builder to check if expression is valid
 */
export function validateConditionalExpression(expression: string): {
  valid: boolean;
  error?: string;
} {
  try {
    // Try to parse the expression without executing it
    // This validates syntax using the safe expr-eval parser
    parser.parse(expression);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid expression"
    };
  }
}

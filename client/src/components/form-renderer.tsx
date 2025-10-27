import { useState, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { FormField, FormTemplate, FormConditionalRule } from "@shared/schema";
import { evaluateConditionalRules } from "@/lib/conditional-logic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Star, Upload } from "lucide-react";

interface FormRendererProps {
  formTemplate: FormTemplate;
  onSubmit: (data: Record<string, any>) => void;
  defaultValues?: Record<string, any>;
  isSubmitting?: boolean;
}

export function FormRenderer({ formTemplate, onSubmit, defaultValues = {}, isSubmitting = false }: FormRendererProps) {
  const fields = (formTemplate.fields as FormField[]) || [];
  const sortedFields = [...fields].sort((a, b) => (a.order || 0) - (b.order || 0));
  const conditionalRules = (formTemplate.conditionalRules as FormConditionalRule[]) || [];

  // State for conditional field visibility/requirements
  const [conditionalStates, setConditionalStates] = useState({
    hidden: new Set<string>(),
    required: new Set<string>(),
    disabled: new Set<string>(),
  });

  // Build dynamic Zod schema based on fields and conditional requirements
  const buildSchema = (condStates: typeof conditionalStates) => {
    const schemaFields: Record<string, z.ZodTypeAny> = {};

    fields.forEach((field) => {
      // Skip hidden fields in validation
      if (condStates.hidden.has(field.id)) {
        schemaFields[field.id] = z.any().optional();
        return;
      }

      let fieldSchema: z.ZodTypeAny;
      // Check if field is required (either by field config or conditional rule)
      const isRequired = field.validation?.required || condStates.required.has(field.id);

      switch (field.type) {
        case "number":
        case "currency":
        case "percentage":
        case "rating":
        case "slider":
          // Accept both string and number inputs, then coerce to number
          fieldSchema = z.union([z.string(), z.number()]).pipe(z.coerce.number());
          if (isRequired) {
            // Required: reject empty strings, null, undefined, and NaN
            fieldSchema = fieldSchema.refine(
              (val) => val !== undefined && val !== null && val !== "" && !isNaN(val),
              { message: "This field is required" }
            );
          }
          if (field.validation?.min !== undefined) {
            fieldSchema = fieldSchema.refine(
              (val) => val === undefined || val >= field.validation!.min!,
              { message: `Value must be at least ${field.validation.min}` }
            );
          }
          if (field.validation?.max !== undefined) {
            fieldSchema = fieldSchema.refine(
              (val) => val === undefined || val <= field.validation!.max!,
              { message: `Value must be at most ${field.validation.max}` }
            );
          }
          if (!isRequired) {
            fieldSchema = fieldSchema.optional();
          }
          break;

        case "email":
          fieldSchema = z.string();
          if (isRequired) {
            fieldSchema = (fieldSchema as z.ZodString).min(1, "Email is required");
          }
          fieldSchema = (fieldSchema as z.ZodString).email("Invalid email address");
          break;

        case "url":
          fieldSchema = z.string();
          if (isRequired) {
            fieldSchema = (fieldSchema as z.ZodString).min(1, "URL is required");
          }
          fieldSchema = (fieldSchema as z.ZodString).url("Invalid URL");
          break;

        case "phone":
          fieldSchema = z.string();
          if (isRequired) {
            fieldSchema = (fieldSchema as z.ZodString).min(1, "Phone number is required");
          }
          fieldSchema = (fieldSchema as z.ZodString).regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/, "Invalid phone number");
          break;

        case "date":
        case "time":
        case "datetime":
          fieldSchema = z.date().or(z.string());
          if (isRequired) {
            fieldSchema = fieldSchema.refine((val) => val !== null && val !== undefined && val !== "", {
              message: "This field is required",
            });
          }
          break;

        case "checkbox":
          if (isRequired) {
            // Required checkbox must be true
            fieldSchema = z.literal(true, {
              errorMap: () => ({ message: "You must accept this" }),
            });
          } else {
            fieldSchema = z.boolean().optional();
          }
          break;

        case "multi_select":
          fieldSchema = z.array(z.string());
          if (isRequired) {
            fieldSchema = (fieldSchema as z.ZodArray<any>).min(1, "Please select at least one option");
          }
          break;

        case "address":
          fieldSchema = z.object({
            street: z.string(),
            city: z.string(),
            state: z.string(),
            zip: z.string(),
            country: z.string(),
          });
          if (isRequired) {
            // Required address must have at least street and city
            fieldSchema = (fieldSchema as any).refine(
              (val: any) => val && val.street && val.street.trim().length > 0 && val.city && val.city.trim().length > 0,
              { message: "Street address and city are required" }
            );
          }
          break;

        case "file_upload":
          fieldSchema = z.any(); // File handling
          if (isRequired) {
            fieldSchema = fieldSchema.refine((val) => val && (val.length > 0 || val instanceof FileList && val.length > 0), {
              message: "Please upload a file",
            });
          }
          break;

        default:
          fieldSchema = z.string();
          if (isRequired) {
            fieldSchema = (fieldSchema as z.ZodString).min(1, field.validation?.errorMessage || "This field is required");
          }
          if (field.validation?.minLength) {
            fieldSchema = (fieldSchema as z.ZodString).min(field.validation.minLength);
          }
          if (field.validation?.maxLength) {
            fieldSchema = (fieldSchema as z.ZodString).max(field.validation.maxLength);
          }
          if (field.validation?.pattern) {
            fieldSchema = (fieldSchema as z.ZodString).regex(new RegExp(field.validation.pattern));
          }
          break;
      }

      // Apply optional for non-required fields (except checkbox which handles its own)
      if (!isRequired && field.type !== "checkbox") {
        fieldSchema = fieldSchema.optional();
      }

      schemaFields[field.id] = fieldSchema;
    });

    return z.object(schemaFields);
  };

  // Reactive schema that updates when conditional states change
  const schema = useMemo(() => buildSchema(conditionalStates), [conditionalStates, fields]);
  
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  // Watch form values and evaluate conditional rules
  const formValues = form.watch();
  
  useEffect(() => {
    if (conditionalRules.length > 0) {
      const newStates = evaluateConditionalRules(conditionalRules, formValues);
      // Only update if states actually changed to avoid infinite loops
      const hasChanged = 
        newStates.hidden.size !== conditionalStates.hidden.size ||
        newStates.required.size !== conditionalStates.required.size ||
        newStates.disabled.size !== conditionalStates.disabled.size ||
        Array.from(newStates.hidden).some(id => !conditionalStates.hidden.has(id)) ||
        Array.from(newStates.required).some(id => !conditionalStates.required.has(id)) ||
        Array.from(newStates.disabled).some(id => !conditionalStates.disabled.has(id));
      
      if (hasChanged) {
        setConditionalStates(newStates);
      }
    }
  }, [formValues, conditionalRules]);

  const handleSubmit = (data: Record<string, any>) => {
    onSubmit(data);
  };

  const renderField = (field: FormField) => {
    const { id, type, label, placeholder, description, helpText, validation, width = "full" } = field;

    // Skip hidden fields from conditional logic
    if (conditionalStates.hidden.has(id)) {
      return null;
    }

    // Skip non-input field types
    if (type === "heading" || type === "divider" || type === "html") {
      return renderStaticField(field);
    }

    // Check if field is required (field validation OR conditional logic)
    const isFieldRequired = validation?.required || conditionalStates.required.has(id);
    // Check if field is disabled by conditional logic
    const isFieldDisabled = conditionalStates.disabled.has(id);

    const widthClass = {
      full: "col-span-12",
      half: "col-span-12 md:col-span-6",
      third: "col-span-12 md:col-span-4",
      quarter: "col-span-12 md:col-span-3",
    }[width];

    return (
      <div key={id} className={widthClass} data-testid={`field-${id}`}>
        <div className="space-y-2">
          {label && (
            <Label htmlFor={id} className="flex items-center gap-1">
              {label}
              {isFieldRequired && <span className="text-destructive">*</span>}
            </Label>
          )}

          <Controller
            name={id}
            control={form.control}
            render={({ field: controllerField, fieldState }) => (
              <>
                {renderFieldInput(field, controllerField, fieldState, isFieldDisabled)}
                {fieldState.error && (
                  <p className="text-sm text-destructive" data-testid={`error-${id}`}>
                    {fieldState.error.message}
                  </p>
                )}
              </>
            )}
          />

          {helpText && (
            <p className="text-sm text-muted-foreground">{helpText}</p>
          )}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
    );
  };

  const renderFieldInput = (field: FormField, controllerField: any, fieldState: any, disabled: boolean = false) => {
    const { id, type, placeholder, options = [] } = field;

    switch (type) {
      case "text":
      case "email":
      case "phone":
      case "url":
        return (
          <Input
            {...controllerField}
            id={id}
            type={type === "text" ? "text" : type}
            placeholder={placeholder}
            disabled={disabled}
            data-testid={`input-${id}`}
          />
        );

      case "textarea":
        return (
          <Textarea
            {...controllerField}
            id={id}
            placeholder={placeholder}
            rows={4}
            disabled={disabled}
            data-testid={`textarea-${id}`}
          />
        );

      case "number":
      case "currency":
      case "percentage":
        return (
          <Input
            {...controllerField}
            id={id}
            type="number"
            placeholder={placeholder}
            disabled={disabled}
            data-testid={`input-${id}`}
            onChange={(e) => {
              const val = e.target.value;
              controllerField.onChange(val === "" ? undefined : parseFloat(val));
            }}
          />
        );

      case "date":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={disabled}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !controllerField.value && "text-muted-foreground"
                )}
                data-testid={`button-date-${id}`}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {controllerField.value ? format(new Date(controllerField.value), "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={controllerField.value ? new Date(controllerField.value) : undefined}
                onSelect={(date) => controllerField.onChange(date)}
                disabled={disabled}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );

      case "time":
        return (
          <Input
            {...controllerField}
            id={id}
            type="time"
            disabled={disabled}
            data-testid={`input-${id}`}
          />
        );

      case "datetime":
        return (
          <Input
            {...controllerField}
            id={id}
            type="datetime-local"
            disabled={disabled}
            data-testid={`input-${id}`}
          />
        );

      case "select":
        return (
          <Select value={controllerField.value} onValueChange={controllerField.onChange} disabled={disabled}>
            <SelectTrigger data-testid={`select-${id}`}>
              <SelectValue placeholder={placeholder || "Select an option"} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "radio":
        return (
          <RadioGroup value={controllerField.value} onValueChange={controllerField.onChange} disabled={disabled}>
            {options.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={`${id}-${option.value}`} data-testid={`radio-${id}-${option.value}`} />
                <Label htmlFor={`${id}-${option.value}`}>{option.label}</Label>
              </div>
            ))}
          </RadioGroup>
        );

      case "checkbox":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={controllerField.value || false}
              onCheckedChange={controllerField.onChange}
              disabled={disabled}
              id={id}
              data-testid={`checkbox-${id}`}
            />
            <Label htmlFor={id} className="text-sm font-normal">
              {field.label}
            </Label>
          </div>
        );

      case "multi_select":
        return (
          <div className="space-y-2">
            {options.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  checked={(controllerField.value || []).includes(option.value)}
                  onCheckedChange={(checked) => {
                    const current = controllerField.value || [];
                    const updated = checked
                      ? [...current, option.value]
                      : current.filter((v: string) => v !== option.value);
                    controllerField.onChange(updated);
                  }}
                  disabled={disabled}
                  id={`${id}-${option.value}`}
                  data-testid={`checkbox-${id}-${option.value}`}
                />
                <Label htmlFor={`${id}-${option.value}`}>{option.label}</Label>
              </div>
            ))}
          </div>
        );

      case "slider":
        return (
          <div className="space-y-2">
            <Slider
              value={[controllerField.value || 0]}
              onValueChange={(values) => controllerField.onChange(values[0])}
              min={field.validation?.min || 0}
              max={field.validation?.max || 100}
              step={1}
              disabled={disabled}
              data-testid={`slider-${id}`}
            />
            <div className="text-sm text-muted-foreground text-center">
              {controllerField.value || 0}
            </div>
          </div>
        );

      case "rating":
        return (
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => !disabled && controllerField.onChange(rating)}
                disabled={disabled}
                className="p-1 hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid={`rating-${id}-${rating}`}
              >
                <Star
                  className={cn(
                    "h-6 w-6",
                    rating <= (controllerField.value || 0)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  )}
                />
              </button>
            ))}
          </div>
        );

      case "file_upload":
        return (
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
            <Input
              type="file"
              id={id}
              onChange={(e) => controllerField.onChange(e.target.files)}
              disabled={disabled}
              className="hidden"
              data-testid={`file-${id}`}
            />
            <Label htmlFor={id} className={cn("cursor-pointer", disabled && "opacity-50 cursor-not-allowed")}>
              <span className="text-sm text-muted-foreground">
                {disabled ? "File upload disabled" : "Click to upload or drag and drop"}
              </span>
            </Label>
          </div>
        );

      case "signature":
        return (
          <div className="border rounded-lg p-4 bg-background">
            <div className="aspect-[3/1] border-b-2 border-foreground/20 flex items-end justify-center pb-2">
              <Input
                {...controllerField}
                id={id}
                placeholder="Type your signature"
                disabled={disabled}
                className="border-0 text-2xl font-cursive text-center"
                data-testid={`signature-${id}`}
              />
            </div>
          </div>
        );

      case "address":
        const addressValue = controllerField.value || { street: "", city: "", state: "", zip: "", country: "" };
        return (
          <div className="space-y-2">
            <Input
              value={addressValue.street || ""}
              onChange={(e) => controllerField.onChange({ ...addressValue, street: e.target.value })}
              placeholder="Street Address"
              disabled={disabled}
              data-testid={`address-street-${id}`}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={addressValue.city || ""}
                onChange={(e) => controllerField.onChange({ ...addressValue, city: e.target.value })}
                placeholder="City"
                disabled={disabled}
                data-testid={`address-city-${id}`}
              />
              <Input
                value={addressValue.state || ""}
                onChange={(e) => controllerField.onChange({ ...addressValue, state: e.target.value })}
                placeholder="State/Province"
                disabled={disabled}
                data-testid={`address-state-${id}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={addressValue.zip || ""}
                onChange={(e) => controllerField.onChange({ ...addressValue, zip: e.target.value })}
                placeholder="ZIP/Postal Code"
                disabled={disabled}
                data-testid={`address-zip-${id}`}
              />
              <Input
                value={addressValue.country || ""}
                onChange={(e) => controllerField.onChange({ ...addressValue, country: e.target.value })}
                placeholder="Country"
                disabled={disabled}
                data-testid={`address-country-${id}`}
              />
            </div>
          </div>
        );

      default:
        return (
          <Input
            {...controllerField}
            id={id}
            placeholder={placeholder}
            disabled={disabled}
            data-testid={`input-${id}`}
          />
        );
    }
  };

  const renderStaticField = (field: FormField) => {
    const { id, type, label, description, width = "full" } = field;

    const widthClass = {
      full: "col-span-12",
      half: "col-span-12 md:col-span-6",
      third: "col-span-12 md:col-span-4",
      quarter: "col-span-12 md:col-span-3",
    }[width];

    switch (type) {
      case "heading":
        return (
          <div key={id} className={cn(widthClass, "pt-4")} data-testid={`heading-${id}`}>
            <h3 className="text-lg font-semibold">{label}</h3>
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
        );

      case "divider":
        return (
          <div key={id} className={widthClass} data-testid={`divider-${id}`}>
            <hr className="my-4 border-t" />
          </div>
        );

      case "html":
        return (
          <div
            key={id}
            className={widthClass}
            dangerouslySetInnerHTML={{ __html: description || "" }}
            data-testid={`html-${id}`}
          />
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{formTemplate.name}</CardTitle>
        {formTemplate.description && (
          <CardDescription>{formTemplate.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="grid grid-cols-12 gap-4">
            {sortedFields.map((field) => renderField(field))}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="submit" disabled={isSubmitting} data-testid="button-submit-form">
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { FormField, FormTemplate } from "@shared/schema";
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

  // Build dynamic Zod schema based on fields
  const buildSchema = () => {
    const schemaFields: Record<string, z.ZodTypeAny> = {};

    fields.forEach((field) => {
      let fieldSchema: z.ZodTypeAny;

      switch (field.type) {
        case "number":
        case "currency":
        case "percentage":
        case "rating":
        case "slider":
          // Accept both string and number inputs, then coerce to number
          fieldSchema = z.union([z.string(), z.number()]).pipe(z.coerce.number());
          if (field.validation?.required) {
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
          if (!field.validation?.required) {
            fieldSchema = fieldSchema.optional();
          }
          break;

        case "email":
          fieldSchema = z.string();
          if (field.validation?.required) {
            fieldSchema = (fieldSchema as z.ZodString).min(1, "Email is required");
          }
          fieldSchema = (fieldSchema as z.ZodString).email("Invalid email address");
          break;

        case "url":
          fieldSchema = z.string();
          if (field.validation?.required) {
            fieldSchema = (fieldSchema as z.ZodString).min(1, "URL is required");
          }
          fieldSchema = (fieldSchema as z.ZodString).url("Invalid URL");
          break;

        case "phone":
          fieldSchema = z.string();
          if (field.validation?.required) {
            fieldSchema = (fieldSchema as z.ZodString).min(1, "Phone number is required");
          }
          fieldSchema = (fieldSchema as z.ZodString).regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/, "Invalid phone number");
          break;

        case "date":
        case "time":
        case "datetime":
          fieldSchema = z.date().or(z.string());
          if (field.validation?.required) {
            fieldSchema = fieldSchema.refine((val) => val !== null && val !== undefined && val !== "", {
              message: "This field is required",
            });
          }
          break;

        case "checkbox":
          if (field.validation?.required) {
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
          if (field.validation?.required) {
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
          if (field.validation?.required) {
            // Required address must have at least street and city
            fieldSchema = (fieldSchema as any).refine(
              (val: any) => val && val.street && val.street.trim().length > 0 && val.city && val.city.trim().length > 0,
              { message: "Street address and city are required" }
            );
          }
          break;

        case "file_upload":
          fieldSchema = z.any(); // File handling
          if (field.validation?.required) {
            fieldSchema = fieldSchema.refine((val) => val && (val.length > 0 || val instanceof FileList && val.length > 0), {
              message: "Please upload a file",
            });
          }
          break;

        default:
          fieldSchema = z.string();
          if (field.validation?.required) {
            fieldSchema = (fieldSchema as z.ZodString).min(1, field.validation.errorMessage || "This field is required");
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
      if (!field.validation?.required && field.type !== "checkbox") {
        fieldSchema = fieldSchema.optional();
      }

      schemaFields[field.id] = fieldSchema;
    });

    return z.object(schemaFields);
  };

  const schema = buildSchema();
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const handleSubmit = (data: Record<string, any>) => {
    onSubmit(data);
  };

  const renderField = (field: FormField) => {
    const { id, type, label, placeholder, description, helpText, validation, width = "full" } = field;

    // Skip non-input field types
    if (type === "heading" || type === "divider" || type === "html") {
      return renderStaticField(field);
    }

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
              {validation?.required && <span className="text-destructive">*</span>}
            </Label>
          )}

          <Controller
            name={id}
            control={form.control}
            render={({ field: controllerField, fieldState }) => (
              <>
                {renderFieldInput(field, controllerField, fieldState)}
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

  const renderFieldInput = (field: FormField, controllerField: any, fieldState: any) => {
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
            data-testid={`input-${id}`}
          />
        );

      case "datetime":
        return (
          <Input
            {...controllerField}
            id={id}
            type="datetime-local"
            data-testid={`input-${id}`}
          />
        );

      case "select":
        return (
          <Select value={controllerField.value} onValueChange={controllerField.onChange}>
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
          <RadioGroup value={controllerField.value} onValueChange={controllerField.onChange}>
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
                onClick={() => controllerField.onChange(rating)}
                className="p-1 hover:scale-110 transition-transform"
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
              className="hidden"
              data-testid={`file-${id}`}
            />
            <Label htmlFor={id} className="cursor-pointer">
              <span className="text-sm text-muted-foreground">
                Click to upload or drag and drop
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
              data-testid={`address-street-${id}`}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={addressValue.city || ""}
                onChange={(e) => controllerField.onChange({ ...addressValue, city: e.target.value })}
                placeholder="City"
                data-testid={`address-city-${id}`}
              />
              <Input
                value={addressValue.state || ""}
                onChange={(e) => controllerField.onChange({ ...addressValue, state: e.target.value })}
                placeholder="State/Province"
                data-testid={`address-state-${id}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={addressValue.zip || ""}
                onChange={(e) => controllerField.onChange({ ...addressValue, zip: e.target.value })}
                placeholder="ZIP/Postal Code"
                data-testid={`address-zip-${id}`}
              />
              <Input
                value={addressValue.country || ""}
                onChange={(e) => controllerField.onChange({ ...addressValue, country: e.target.value })}
                placeholder="Country"
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

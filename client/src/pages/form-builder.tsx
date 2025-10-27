import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { FormTemplate, FormField, FormFieldType, FormConditionalRule } from "@shared/schema";
import { validateConditionalExpression } from "@/lib/conditional-logic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Edit, GripVertical, Save, Eye, Sparkles } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField as FormFieldComponent, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Text Area" },
  { value: "number", label: "Number" },
  { value: "decimal", label: "Decimal Number" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "url", label: "URL" },
  { value: "name", label: "Full Name" },
  { value: "address", label: "Address" },
  { value: "currency", label: "Currency" },
  { value: "percentage", label: "Percentage" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "datetime", label: "Date & Time" },
  { value: "select", label: "Dropdown" },
  { value: "multi_select", label: "Multi-Select" },
  { value: "radio", label: "Radio Buttons" },
  { value: "checkbox", label: "Checkbox" },
  { value: "file_upload", label: "File Upload" },
  { value: "signature", label: "Signature" },
  { value: "rating", label: "Rating" },
  { value: "slider", label: "Slider" },
  { value: "calculated", label: "Calculated Field" },
  { value: "heading", label: "Heading" },
  { value: "divider", label: "Divider" },
  { value: "html", label: "HTML Content" },
];

const fieldSchema = z.object({
  type: z.enum([
    "text", "textarea", "number", "decimal", "email", "phone", "url",
    "name", "address", "currency", "percentage",
    "date", "time", "datetime", "select", "multi_select", "radio",
    "checkbox", "file_upload", "signature",
    "rating", "slider", "calculated", "heading", "divider", "html"
  ]),
  label: z.string().min(1, "Label is required"),
  placeholder: z.string().optional(),
  description: z.string().optional(),
  helpText: z.string().optional(),
  required: z.boolean().default(false),
  width: z.enum(["full", "half", "third", "quarter"]).default("full"),
});

type FieldFormValues = z.infer<typeof fieldSchema>;

export default function FormBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [fields, setFields] = useState<FormField[]>([]);
  const [conditionalRules, setConditionalRules] = useState<FormConditionalRule[]>([]);
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [editingRule, setEditingRule] = useState<FormConditionalRule | null>(null);

  const { data: formTemplate, isLoading } = useQuery<FormTemplate>({
    queryKey: ["/api/forms", id],
    enabled: !!id,
  });

  useEffect(() => {
    if (formTemplate?.fields) {
      setFields(formTemplate.fields as FormField[]);
    }
    if (formTemplate?.conditionalRules) {
      setConditionalRules(formTemplate.conditionalRules as FormConditionalRule[]);
    }
  }, [formTemplate]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No form ID");
      // Send both fields and conditional rules
      return apiRequest("PUT", `/api/forms/${id}`, {
        fields,
        conditionalRules,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms", id] });
      toast({
        title: "Form saved",
        description: "Your changes have been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const handleAddField = (fieldData: FieldFormValues) => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type: fieldData.type,
      label: fieldData.label,
      placeholder: fieldData.placeholder,
      description: fieldData.description,
      helpText: fieldData.helpText,
      validation: {
        required: fieldData.required,
      },
      width: fieldData.width,
      order: fields.length,
    };

    setFields([...fields, newField]);
    setFieldDialogOpen(false);
    setEditingField(null);
  };

  const handleUpdateField = (fieldData: FieldFormValues) => {
    if (!editingField) return;

    const updatedFields = fields.map((f) =>
      f.id === editingField.id
        ? {
            ...f,
            type: fieldData.type,
            label: fieldData.label,
            placeholder: fieldData.placeholder,
            description: fieldData.description,
            helpText: fieldData.helpText,
            validation: {
              ...f.validation,
              required: fieldData.required,
            },
            width: fieldData.width,
          }
        : f
    );

    setFields(updatedFields);
    setFieldDialogOpen(false);
    setEditingField(null);
  };

  const handleDeleteField = (fieldId: string) => {
    // Filter out deleted field and re-rank order
    const remainingFields = fields
      .filter((f) => f.id !== fieldId)
      .map((f, index) => ({
        ...f,
        order: index,
      }));
    setFields(remainingFields);
  };

  const handleAddRule = (rule: Omit<FormConditionalRule, "id">) => {
    const newRule: FormConditionalRule = {
      id: `rule_${Date.now()}`,
      ...rule,
    };
    setConditionalRules([...conditionalRules, newRule]);
    setRuleDialogOpen(false);
    setEditingRule(null);
  };

  const handleUpdateRule = (rule: Omit<FormConditionalRule, "id">) => {
    if (!editingRule) return;
    const updatedRules = conditionalRules.map((r) =>
      r.id === editingRule.id ? { ...editingRule, ...rule } : r
    );
    setConditionalRules(updatedRules);
    setRuleDialogOpen(false);
    setEditingRule(null);
  };

  const handleDeleteRule = (ruleId: string) => {
    setConditionalRules(conditionalRules.filter((r) => r.id !== ruleId));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading form...</div>
      </div>
    );
  }

  if (!formTemplate) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Form not found</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/forms")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{formTemplate.name}</h1>
            <p className="text-sm text-muted-foreground">{formTemplate.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setLocation(`/forms/${id}/preview`)}
            data-testid="button-preview-form"
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid="button-save-form"
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Add Field Button */}
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-center py-12">
              <Button
                onClick={() => {
                  setEditingField(null);
                  setFieldDialogOpen(true);
                }}
                data-testid="button-add-field"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Field
              </Button>
            </CardContent>
          </Card>

          {/* Fields List */}
          {fields.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground mb-4">No fields added yet</p>
                <p className="text-sm text-muted-foreground">
                  Click "Add Field" to start building your form
                </p>
              </CardContent>
            </Card>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={fields.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {fields.map((field) => (
                    <SortableFieldCard
                      key={field.id}
                      field={field}
                      onEdit={() => {
                        setEditingField(field);
                        setFieldDialogOpen(true);
                      }}
                      onDelete={() => handleDeleteField(field.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Conditional Rules Section */}
          <Card className="mt-8">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Conditional Logic
                </CardTitle>
                <CardDescription className="mt-1.5">
                  Show, hide, require, or disable fields based on user responses
                </CardDescription>
              </div>
              <Button
                onClick={() => {
                  setEditingRule(null);
                  setRuleDialogOpen(true);
                }}
                size="sm"
                data-testid="button-add-rule"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </CardHeader>
            <CardContent>
              {conditionalRules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No conditional rules yet</p>
                  <p className="text-xs mt-1">Create rules to dynamically control form fields</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {conditionalRules.map((rule) => (
                    <Card key={rule.id} className="border-l-4 border-l-primary/20" data-testid={`rule-card-${rule.id}`}>
                      <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{rule.action.toUpperCase()}</code>
                            <span className="text-xs text-muted-foreground">
                              {rule.targetFieldIds.length} field{rule.targetFieldIds.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <code className="text-sm">{rule.condition}</code>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingRule(rule);
                              setRuleDialogOpen(true);
                            }}
                            data-testid={`button-edit-rule-${rule.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRule(rule.id)}
                            data-testid={`button-delete-rule-${rule.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Field Dialog */}
      <FieldDialog
        open={fieldDialogOpen}
        onOpenChange={setFieldDialogOpen}
        field={editingField}
        onSubmit={editingField ? handleUpdateField : handleAddField}
      />

      {/* Conditional Rule Dialog */}
      <ConditionalRuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        rule={editingRule}
        fields={fields}
        onSubmit={editingRule ? handleUpdateRule : handleAddRule}
      />
    </div>
  );
}

interface FieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: FormField | null;
  onSubmit: (data: FieldFormValues) => void;
}

function FieldDialog({ open, onOpenChange, field, onSubmit }: FieldDialogProps) {
  const form = useForm<FieldFormValues>({
    resolver: zodResolver(fieldSchema),
    defaultValues: {
      type: "text",
      label: "",
      placeholder: "",
      description: "",
      helpText: "",
      required: false,
      width: "full",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        type: field?.type || "text",
        label: field?.label || "",
        placeholder: field?.placeholder || "",
        description: field?.description || "",
        helpText: field?.helpText || "",
        required: field?.validation?.required || false,
        width: field?.width || "full",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, field]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-field-editor">
        <DialogHeader>
          <DialogTitle>{field ? "Edit Field" : "Add Field"}</DialogTitle>
          <DialogDescription>
            {field ? "Update the field properties below." : "Configure the new field properties below."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormFieldComponent
              control={form.control}
              name="type"
              render={({ field: fieldProps }) => (
                <FormItem>
                  <FormLabel>Field Type</FormLabel>
                  <Select
                    value={fieldProps.value}
                    onValueChange={fieldProps.onChange}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-field-type">
                        <SelectValue placeholder="Select field type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FIELD_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormFieldComponent
              control={form.control}
              name="label"
              render={({ field: fieldProps }) => (
                <FormItem>
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <Input
                      {...fieldProps}
                      placeholder="e.g., Full Name"
                      data-testid="input-field-label"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormFieldComponent
              control={form.control}
              name="placeholder"
              render={({ field: fieldProps }) => (
                <FormItem>
                  <FormLabel>Placeholder (optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...fieldProps}
                      placeholder="e.g., Enter your full name"
                      data-testid="input-field-placeholder"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormFieldComponent
              control={form.control}
              name="description"
              render={({ field: fieldProps }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...fieldProps}
                      placeholder="Additional context for this field"
                      data-testid="input-field-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormFieldComponent
              control={form.control}
              name="helpText"
              render={({ field: fieldProps }) => (
                <FormItem>
                  <FormLabel>Help Text (optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...fieldProps}
                      placeholder="Helpful hint for users"
                      data-testid="input-field-help-text"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormFieldComponent
              control={form.control}
              name="width"
              render={({ field: fieldProps }) => (
                <FormItem>
                  <FormLabel>Field Width</FormLabel>
                  <Select
                    value={fieldProps.value}
                    onValueChange={fieldProps.onChange}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-field-width">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="full">Full Width</SelectItem>
                      <SelectItem value="half">Half Width</SelectItem>
                      <SelectItem value="third">One Third</SelectItem>
                      <SelectItem value="quarter">One Quarter</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormFieldComponent
              control={form.control}
              name="required"
              render={({ field: fieldProps }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Required Field</FormLabel>
                    <FormDescription>
                      Users must fill this field to submit the form
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={fieldProps.value}
                      onCheckedChange={fieldProps.onChange}
                      data-testid="switch-field-required"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-field"
              >
                Cancel
              </Button>
              <Button type="submit" data-testid="button-save-field">
                {field ? "Update Field" : "Add Field"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface ConditionalRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: FormConditionalRule | null;
  fields: FormField[];
  onSubmit: (data: Omit<FormConditionalRule, "id">) => void;
}

const ruleSchema = z.object({
  condition: z.string().min(1, "Condition expression is required").refine(
    (val) => validateConditionalExpression(val).valid,
    (val) => ({ message: validateConditionalExpression(val).error || "Invalid expression" })
  ),
  action: z.enum(["show", "hide", "require", "disable"]),
  targetFieldIds: z.array(z.string()).min(1, "Select at least one target field"),
});

type RuleFormValues = z.infer<typeof ruleSchema>;

function ConditionalRuleDialog({ open, onOpenChange, rule, fields, onSubmit }: ConditionalRuleDialogProps) {
  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      condition: "",
      action: "show",
      targetFieldIds: [],
    },
  });

  useEffect(() => {
    if (rule) {
      form.reset({
        condition: rule.condition,
        action: rule.action,
        targetFieldIds: rule.targetFieldIds,
      });
    } else {
      form.reset({
        condition: "",
        action: "show",
        targetFieldIds: [],
      });
    }
  }, [rule, form]);

  const handleSubmit = (data: RuleFormValues) => {
    onSubmit(data);
    form.reset();
  };

  const inputFields = fields.filter(f => 
    f.type !== "heading" && f.type !== "divider" && f.type !== "html"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit" : "Add"} Conditional Rule</DialogTitle>
          <DialogDescription>
            Control field visibility or requirements based on form values
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormFieldComponent
              control={form.control}
              name="condition"
              render={({ field: fieldProps }) => (
                <FormItem>
                  <FormLabel>Condition Expression</FormLabel>
                  <FormControl>
                    <Textarea
                      {...fieldProps}
                      placeholder="Example: field_1234 > 1000 or field_5678 == 'employed'"
                      rows={3}
                      data-testid="input-rule-condition"
                    />
                  </FormControl>
                  <FormDescription>
                    Use field IDs from above (e.g., field_123). Supports: {">  <  ==  !=  >=  <=  and  or  not"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormFieldComponent
              control={form.control}
              name="action"
              render={({ field: fieldProps }) => (
                <FormItem>
                  <FormLabel>Action</FormLabel>
                  <Select value={fieldProps.value} onValueChange={fieldProps.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-rule-action">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="show">Show - Field appears when condition is true</SelectItem>
                      <SelectItem value="hide">Hide - Field disappears when condition is true</SelectItem>
                      <SelectItem value="require">Require - Field becomes required when condition is true</SelectItem>
                      <SelectItem value="disable">Disable - Field becomes read-only when condition is true</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormFieldComponent
              control={form.control}
              name="targetFieldIds"
              render={({ field: fieldProps }) => (
                <FormItem>
                  <FormLabel>Target Fields</FormLabel>
                  <FormDescription className="mb-3">
                    Select which fields this rule should affect
                  </FormDescription>
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-3">
                    {inputFields.map((field) => (
                      <div key={field.id} className="flex items-center space-x-2">
                        <Checkbox
                          checked={fieldProps.value.includes(field.id)}
                          onCheckedChange={(checked) => {
                            const updated = checked
                              ? [...fieldProps.value, field.id]
                              : fieldProps.value.filter((id) => id !== field.id);
                            fieldProps.onChange(updated);
                          }}
                          data-testid={`checkbox-target-${field.id}`}
                        />
                        <Label className="flex-1 cursor-pointer font-normal">
                          {field.label}
                          <span className="text-xs text-muted-foreground ml-2">({field.id})</span>
                        </Label>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-rule"
              >
                Cancel
              </Button>
              <Button type="submit" data-testid="button-save-rule">
                {rule ? "Update Rule" : "Add Rule"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface SortableFieldCardProps {
  field: FormField;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableFieldCard({ field, onEdit, onDelete }: SortableFieldCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      data-testid={`field-card-${field.id}`}
      className={isDragging ? "shadow-lg" : ""}
    >
      <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-4">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground touch-none"
          data-testid={`drag-handle-${field.id}`}
        >
          <GripVertical className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-base">{field.label}</CardTitle>
          <CardDescription>
            {FIELD_TYPES.find((t) => t.value === field.type)?.label}
            {field.validation?.required && " • Required"}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            data-testid={`button-edit-field-${field.id}`}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            data-testid={`button-delete-field-${field.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      {field.description && (
        <CardContent>
          <p className="text-sm text-muted-foreground">{field.description}</p>
        </CardContent>
      )}
    </Card>
  );
}

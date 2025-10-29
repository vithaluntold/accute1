import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Trash2, 
  Mail, 
  FileText, 
  Receipt, 
  Clock, 
  Workflow 
} from "lucide-react";

export interface AutomationAction {
  id: string;
  type: 'send_email' | 'trigger_form' | 'send_invoice' | 'schedule_followup' | 'trigger_workflow';
  config: Record<string, any>;
}

interface AutomationActionsEditorProps {
  actions: AutomationAction[];
  onChange: (actions: AutomationAction[]) => void;
  onValidationChange?: (isValid: boolean) => void;
}

const actionTypeConfig = {
  send_email: { 
    icon: Mail, 
    label: 'Send Email', 
    color: 'bg-blue-500' 
  },
  trigger_form: { 
    icon: FileText, 
    label: 'Trigger Form', 
    color: 'bg-green-500' 
  },
  send_invoice: { 
    icon: Receipt, 
    label: 'Send Invoice', 
    color: 'bg-yellow-500' 
  },
  schedule_followup: { 
    icon: Clock, 
    label: 'Schedule Follow-up', 
    color: 'bg-purple-500' 
  },
  trigger_workflow: { 
    icon: Workflow, 
    label: 'Trigger Workflow', 
    color: 'bg-pink-500' 
  },
};

export function AutomationActionsEditor({ actions, onChange, onValidationChange }: AutomationActionsEditorProps) {
  const [selectedActionType, setSelectedActionType] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Fetch email templates
  const { data: emailTemplates = [] } = useQuery<any[]>({
    queryKey: ['/api/email-templates'],
  });

  // Fetch form templates
  const { data: formTemplates = [] } = useQuery<any[]>({
    queryKey: ['/api/forms'],
  });

  // Fetch workflows for trigger_workflow
  const { data: workflows = [] } = useQuery<any[]>({
    queryKey: ['/api/workflows'],
  });

  const addAction = () => {
    if (!selectedActionType) return;
    
    const newAction: AutomationAction = {
      id: crypto.randomUUID(),
      type: selectedActionType as any,
      config: getDefaultConfig(selectedActionType as any),
    };
    
    const updatedActions = [...actions, newAction];
    onChange(updatedActions);
    setSelectedActionType('');
    
    // Validate new action
    if (!validateAction(newAction)) {
      setValidationErrors({
        ...validationErrors,
        [newAction.id]: getValidationError(newAction)
      });
      onValidationChange?.(false);
    }
  };

  const validateAction = (action: AutomationAction): boolean => {
    const { type, config } = action;
    switch (type) {
      case 'send_email':
        return !!(config.templateId && config.recipient);
      case 'trigger_form':
        return !!(config.formId && config.assignTo);
      case 'send_invoice':
        return !!(config.description && config.amount && config.clientId);
      case 'schedule_followup':
        return !!(config.delayDays && config.taskName);
      case 'trigger_workflow':
        return !!(config.workflowId && config.clientId);
      default:
        return false;
    }
  };

  const removeAction = (id: string) => {
    const updatedActions = actions.filter(a => a.id !== id);
    onChange(updatedActions);
    
    // Remove validation error for this action
    const newErrors = { ...validationErrors };
    delete newErrors[id];
    setValidationErrors(newErrors);
    
    // Check if all remaining actions are valid
    onValidationChange?.(Object.keys(newErrors).length === 0);
  };

  const updateActionConfig = (id: string, config: Record<string, any>) => {
    const updatedActions = actions.map(a => 
      a.id === id ? { ...a, config } : a
    );
    onChange(updatedActions);
    
    // Validate and update errors
    const errors: Record<string, string> = {};
    updatedActions.forEach(action => {
      if (!validateAction(action)) {
        errors[action.id] = getValidationError(action);
      }
    });
    setValidationErrors(errors);
    onValidationChange?.(Object.keys(errors).length === 0);
  };

  const getValidationError = (action: AutomationAction): string => {
    const { type, config } = action;
    switch (type) {
      case 'send_email':
        if (!config.templateId) return 'Please select an email template';
        if (!config.recipient) return 'Please specify a recipient';
        return '';
      case 'trigger_form':
        if (!config.formId) return 'Please select a form';
        if (!config.assignTo) return 'Please specify who to assign to';
        return '';
      case 'send_invoice':
        if (!config.description) return 'Please enter a description';
        if (!config.amount || (typeof config.amount === 'number' && config.amount <= 0)) return 'Please enter a valid amount';
        if (!config.clientId) return 'Please specify a client ID';
        return '';
      case 'schedule_followup':
        if (!config.delayDays || config.delayDays < 1) return 'Please enter a valid delay';
        if (!config.taskName) return 'Please enter a task name';
        return '';
      case 'trigger_workflow':
        if (!config.workflowId) return 'Please select a workflow';
        if (!config.clientId) return 'Please specify a client ID';
        return '';
      default:
        return '';
    }
  };

  const getDefaultConfig = (type: string): Record<string, any> => {
    switch (type) {
      case 'send_email':
        return { templateId: '', recipient: '{{client_email}}' };
      case 'trigger_form':
        return { formId: '', assignTo: '{{client}}' };
      case 'send_invoice':
        return { description: '', amount: 0, clientId: '{{client_id}}' };
      case 'schedule_followup':
        return { delayDays: 7, taskName: '', description: '' };
      case 'trigger_workflow':
        return { workflowId: '', clientId: '{{client_id}}' };
      default:
        return {};
    }
  };

  const renderActionConfig = (action: AutomationAction) => {
    const { type, config, id } = action;
    const ActionIcon = actionTypeConfig[type].icon;

    switch (type) {
      case 'send_email':
        return (
          <Card key={id} data-testid={`automation-action-${id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded ${actionTypeConfig[type].color} text-white`}>
                    <ActionIcon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-sm">{actionTypeConfig[type].label}</CardTitle>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeAction(id)}
                  data-testid={`button-remove-action-${id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Email Template</Label>
                <Select
                  value={config.templateId || ''}
                  onValueChange={(value) => 
                    updateActionConfig(id, { ...config, templateId: value })
                  }
                >
                  <SelectTrigger data-testid={`select-email-template-${id}`}>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    {emailTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Recipient</Label>
                <Input
                  value={config.recipient || ''}
                  onChange={(e) => 
                    updateActionConfig(id, { ...config, recipient: e.target.value })
                  }
                  placeholder="{{client_email}} or specific email"
                  data-testid={`input-email-recipient-${id}`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use variables: {'{{client_email}}'}, {'{{user_email}}'}
                </p>
              </div>
              {validationErrors[id] && (
                <div className="text-sm text-destructive" data-testid={`error-action-${id}`}>
                  {validationErrors[id]}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'trigger_form':
        return (
          <Card key={id} data-testid={`automation-action-${id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded ${actionTypeConfig[type].color} text-white`}>
                    <ActionIcon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-sm">{actionTypeConfig[type].label}</CardTitle>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeAction(id)}
                  data-testid={`button-remove-action-${id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Form Template</Label>
                <Select
                  value={config.formId || ''}
                  onValueChange={(value) => 
                    updateActionConfig(id, { ...config, formId: value })
                  }
                >
                  <SelectTrigger data-testid={`select-form-template-${id}`}>
                    <SelectValue placeholder="Select form" />
                  </SelectTrigger>
                  <SelectContent>
                    {formTemplates.map((form) => (
                      <SelectItem key={form.id} value={form.id}>
                        {form.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assign To</Label>
                <Input
                  value={config.assignTo || ''}
                  onChange={(e) => 
                    updateActionConfig(id, { ...config, assignTo: e.target.value })
                  }
                  placeholder="{{client}} or {{user}}"
                  data-testid={`input-form-assign-to-${id}`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use variables: {'{{client}}'}, {'{{user}}'}
                </p>
              </div>
              {validationErrors[id] && (
                <div className="text-sm text-destructive" data-testid={`error-action-${id}`}>
                  {validationErrors[id]}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'send_invoice':
        return (
          <Card key={id} data-testid={`automation-action-${id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded ${actionTypeConfig[type].color} text-white`}>
                    <ActionIcon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-sm">{actionTypeConfig[type].label}</CardTitle>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeAction(id)}
                  data-testid={`button-remove-action-${id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Description</Label>
                <Input
                  value={config.description || ''}
                  onChange={(e) => 
                    updateActionConfig(id, { ...config, description: e.target.value })
                  }
                  placeholder="Invoice description"
                  data-testid={`input-invoice-description-${id}`}
                />
              </div>
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={config.amount || '0'}
                  onChange={(e) => {
                    const numValue = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                    updateActionConfig(id, { ...config, amount: numValue });
                  }}
                  placeholder="0.00"
                  data-testid={`input-invoice-amount-${id}`}
                />
              </div>
              <div>
                <Label>Client ID</Label>
                <Input
                  value={config.clientId || ''}
                  onChange={(e) => 
                    updateActionConfig(id, { ...config, clientId: e.target.value })
                  }
                  placeholder="{{client_id}}"
                  data-testid={`input-invoice-client-${id}`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use variable: {'{{client_id}}'}
                </p>
              </div>
              {validationErrors[id] && (
                <div className="text-sm text-destructive" data-testid={`error-action-${id}`}>
                  {validationErrors[id]}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'schedule_followup':
        return (
          <Card key={id} data-testid={`automation-action-${id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded ${actionTypeConfig[type].color} text-white`}>
                    <ActionIcon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-sm">{actionTypeConfig[type].label}</CardTitle>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeAction(id)}
                  data-testid={`button-remove-action-${id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Delay (Days)</Label>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={config.delayDays || 7}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 7 : Math.max(1, Math.min(365, parseInt(e.target.value) || 7));
                    updateActionConfig(id, { ...config, delayDays: value });
                  }}
                  placeholder="7"
                  data-testid={`input-followup-delay-${id}`}
                />
              </div>
              <div>
                <Label>Task Name</Label>
                <Input
                  value={config.taskName || ''}
                  onChange={(e) => 
                    updateActionConfig(id, { ...config, taskName: e.target.value })
                  }
                  placeholder="Follow-up task name"
                  data-testid={`input-followup-task-name-${id}`}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={config.description || ''}
                  onChange={(e) => 
                    updateActionConfig(id, { ...config, description: e.target.value })
                  }
                  placeholder="Task description"
                  rows={3}
                  data-testid={`input-followup-description-${id}`}
                />
              </div>
              {validationErrors[id] && (
                <div className="text-sm text-destructive" data-testid={`error-action-${id}`}>
                  {validationErrors[id]}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'trigger_workflow':
        return (
          <Card key={id} data-testid={`automation-action-${id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded ${actionTypeConfig[type].color} text-white`}>
                    <ActionIcon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-sm">{actionTypeConfig[type].label}</CardTitle>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeAction(id)}
                  data-testid={`button-remove-action-${id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Workflow</Label>
                <Select
                  value={config.workflowId || ''}
                  onValueChange={(value) => 
                    updateActionConfig(id, { ...config, workflowId: value })
                  }
                >
                  <SelectTrigger data-testid={`select-workflow-${id}`}>
                    <SelectValue placeholder="Select workflow" />
                  </SelectTrigger>
                  <SelectContent>
                    {workflows.map((workflow) => (
                      <SelectItem key={workflow.id} value={workflow.id}>
                        {workflow.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Client ID</Label>
                <Input
                  value={config.clientId || ''}
                  onChange={(e) => 
                    updateActionConfig(id, { ...config, clientId: e.target.value })
                  }
                  placeholder="{{client_id}}"
                  data-testid={`input-workflow-client-${id}`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use variable: {'{{client_id}}'}
                </p>
              </div>
              {validationErrors[id] && (
                <div className="text-sm text-destructive" data-testid={`error-action-${id}`}>
                  {validationErrors[id]}
                </div>
              )}
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4" data-testid="automation-actions-editor">
      <div>
        <Label>Add Automation Action</Label>
        <div className="flex gap-2 mt-2">
          <Select value={selectedActionType} onValueChange={setSelectedActionType}>
            <SelectTrigger data-testid="select-action-type">
              <SelectValue placeholder="Select action type" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(actionTypeConfig).map(([type, config]) => {
                const Icon = config.icon;
                return (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {config.label}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Button
            onClick={addAction}
            disabled={!selectedActionType}
            data-testid="button-add-action"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>
      </div>

      {actions.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-sm text-muted-foreground">
              No automation actions configured. Add actions above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {actions.map(action => renderActionConfig(action))}
        </div>
      )}
    </div>
  );
}

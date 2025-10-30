import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, ArrowLeft, Save, Loader2, FileText, Workflow, LayoutTemplate, Mail, MessageSquare } from "lucide-react";
import { useLocation } from "wouter";

interface TemplateSource {
  id: string;
  name: string;
  description?: string | null;
  type?: string;
  subject?: string;
  content?: string;
}

export default function MarketplaceCreatePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [templateType, setTemplateType] = useState<'document_template' | 'form_template' | 'pipeline_template' | 'email_template' | 'message_template'>('document_template');
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    pricingModel: "free" as 'free' | 'one_time' | 'subscription',
    price: "0",
    priceYearly: "",
    tags: "",
  });

  const { data: sourceForms = [] } = useQuery<TemplateSource[]>({
    queryKey: ['/api/forms'],
    enabled: templateType === 'form_template',
  });

  const { data: sourceWorkflows = [] } = useQuery<TemplateSource[]>({
    queryKey: ['/api/workflows'],
    enabled: templateType === 'pipeline_template',
  });

  const { data: sourceDocuments = [] } = useQuery<TemplateSource[]>({
    queryKey: ['/api/documents'],
    enabled: templateType === 'document_template',
  });

  const { data: sourceEmailTemplates = [] } = useQuery<TemplateSource[]>({
    queryKey: ['/api/email-templates'],
    enabled: templateType === 'email_template',
  });

  const { data: sourceMessageTemplates = [] } = useQuery<TemplateSource[]>({
    queryKey: ['/api/message-templates'],
    enabled: templateType === 'message_template',
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/marketplace/items', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/items'] });
      toast({
        title: 'Success',
        description: 'Marketplace template created successfully',
      });
      navigate('/admin/marketplace/published');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create marketplace template',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSourceId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a source template',
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      name: formData.name,
      description: formData.description,
      category: templateType,
      type: templateType === 'pipeline_template' ? 'workflow' : templateType.replace('_template', ''),
      pricingModel: formData.pricingModel,
      price: formData.price,
      priceYearly: formData.pricingModel === 'subscription' ? formData.priceYearly : null,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      sourceId: selectedSourceId,
      isFeatured: false,
      status: 'active',
    };

    createMutation.mutate(payload);
  };

  const getSourceTemplates = () => {
    switch (templateType) {
      case 'form_template':
        return sourceForms;
      case 'pipeline_template':
        return sourceWorkflows;
      case 'document_template':
        return sourceDocuments;
      case 'email_template':
        return sourceEmailTemplates;
      case 'message_template':
        return sourceMessageTemplates;
      default:
        return [];
    }
  };

  const getTypeIcon = () => {
    switch (templateType) {
      case 'form_template':
        return <LayoutTemplate className="w-5 h-5" />;
      case 'pipeline_template':
        return <Workflow className="w-5 h-5" />;
      case 'document_template':
        return <FileText className="w-5 h-5" />;
      case 'email_template':
        return <Mail className="w-5 h-5" />;
      case 'message_template':
        return <MessageSquare className="w-5 h-5" />;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/admin/marketplace/published')}
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-display font-bold">Create Marketplace Template</h1>
          <p className="text-muted-foreground mt-1">
            Publish a template to the marketplace for all organizations
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getTypeIcon()}
              Template Details
            </CardTitle>
            <CardDescription>
              Fill in the template information and select a source to publish
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="template-type" data-testid="label-template-type">Template Type</Label>
              <Select
                value={templateType}
                onValueChange={(value: any) => {
                  setTemplateType(value);
                  setSelectedSourceId("");
                }}
              >
                <SelectTrigger id="template-type" data-testid="select-template-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="document_template" data-testid="option-document">Document Template</SelectItem>
                  <SelectItem value="form_template" data-testid="option-form">Form Template</SelectItem>
                  <SelectItem value="pipeline_template" data-testid="option-workflow">Workflow Template</SelectItem>
                  <SelectItem value="email_template" data-testid="option-email">Email Template</SelectItem>
                  <SelectItem value="message_template" data-testid="option-message">Message Template</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source-template" data-testid="label-source-template">Source Template</Label>
              <Select value={selectedSourceId} onValueChange={setSelectedSourceId}>
                <SelectTrigger id="source-template" data-testid="select-source-template">
                  <SelectValue placeholder="Select a template to publish" />
                </SelectTrigger>
                <SelectContent>
                  {getSourceTemplates().map((template) => (
                    <SelectItem key={template.id} value={template.id} data-testid={`option-source-${template.id}`}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Choose an existing {templateType.replace('_', ' ')} to publish
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" data-testid="label-name">Display Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter template name"
                required
                data-testid="input-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" data-testid="label-description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this template does"
                rows={4}
                required
                data-testid="textarea-description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" data-testid="label-category">Category *</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., Tax, Audit, Bookkeeping"
                required
                data-testid="input-category"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pricing-model" data-testid="label-pricing">Pricing Model</Label>
              <Select
                value={formData.pricingModel}
                onValueChange={(value: any) => setFormData({ ...formData, pricingModel: value })}
              >
                <SelectTrigger id="pricing-model" data-testid="select-pricing">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free" data-testid="option-free">Free</SelectItem>
                  <SelectItem value="one_time" data-testid="option-onetime">One-Time Purchase</SelectItem>
                  <SelectItem value="subscription" data-testid="option-subscription">Subscription</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.pricingModel !== 'free' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price" data-testid="label-price">
                    {formData.pricingModel === 'subscription' ? 'Monthly Price' : 'Price'} *
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    required={formData.pricingModel !== 'free'}
                    data-testid="input-price"
                  />
                </div>
                
                {formData.pricingModel === 'subscription' && (
                  <div className="space-y-2">
                    <Label htmlFor="price-yearly" data-testid="label-price-yearly">Yearly Price</Label>
                    <Input
                      id="price-yearly"
                      type="number"
                      step="0.01"
                      value={formData.priceYearly}
                      onChange={(e) => setFormData({ ...formData, priceYearly: e.target.value })}
                      placeholder="0.00"
                      data-testid="input-price-yearly"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="tags" data-testid="label-tags">Tags</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="tax, compliance, audit (comma-separated)"
                data-testid="input-tags"
              />
              <p className="text-sm text-muted-foreground">
                Separate tags with commas
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-publish"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Publish Template
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/admin/marketplace/published')}
                disabled={createMutation.isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

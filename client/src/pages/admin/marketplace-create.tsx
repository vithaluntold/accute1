import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, ArrowRight, Loader2, FileText, Workflow, LayoutTemplate, Mail, MessageSquare, Package } from "lucide-react";
import { useLocation } from "wouter";

export default function MarketplaceCreatePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [templateType, setTemplateType] = useState<'document_template' | 'form_template' | 'pipeline_template' | 'email_template' | 'message_template'>('document_template');
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    pricingModel: "free" as 'free' | 'one_time' | 'subscription',
    price: "0",
    priceYearly: "",
    tags: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/marketplace/items', data);
      return res.json();
    },
    onSuccess: (data) => {
      const marketplaceTemplateId = data.id;
      
      // Pass metadata as query params to pre-fill create dialog
      const params = new URLSearchParams({
        marketplaceTemplateId,
        name: formData.name,
        description: formData.description,
        category: formData.category,
      });
      
      // Redirect to appropriate page with marketplaceTemplateId and metadata to trigger creation
      switch (templateType) {
        case 'form_template':
          navigate(`/forms?${params.toString()}`);
          break;
        case 'pipeline_template':
          navigate(`/workflows?${params.toString()}`);
          break;
        case 'document_template':
          navigate(`/documents?${params.toString()}`);
          break;
        case 'email_template':
          navigate(`/email-templates?${params.toString()}`);
          break;
        case 'message_template':
          navigate(`/message-templates?${params.toString()}`);
          break;
      }
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

    const payload = {
      name: formData.name,
      description: formData.description,
      category: templateType,
      type: templateType === 'pipeline_template' ? 'workflow' : templateType.replace('_template', ''),
      pricingModel: formData.pricingModel,
      price: formData.price,
      priceYearly: formData.pricingModel === 'subscription' ? formData.priceYearly : null,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      sourceId: null, // Will be linked later from the builder
      isFeatured: false,
      status: 'active',
    };

    createMutation.mutate(payload);
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
    <div>
      {/* Gradient Hero Section */}
      <div className="relative mb-8">
        <div className="absolute inset-0 gradient-hero opacity-90"></div>
        <div className="relative container mx-auto p-6 md:p-8">
          <div className="flex items-center justify-between">
            <div className="max-w-4xl flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate('/admin/marketplace/published')}
                data-testid="button-back"
                className="bg-white/10 hover:bg-white/20 border-white/20 text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Package className="h-10 w-10 text-white" />
                  <h1 className="text-4xl md:text-5xl font-display font-bold text-white">Create Marketplace Template</h1>
                </div>
                <p className="text-white/90 text-lg">Step 1: Fill in marketplace details. Step 2: Create template content in the dedicated builder.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 max-w-4xl">

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getTypeIcon()}
              Marketplace Template Information
            </CardTitle>
            <CardDescription>
              Provide basic template information. You'll be redirected to create the actual template content next.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="template-type" data-testid="label-template-type">Template Type *</Label>
              <Select
                value={templateType}
                onValueChange={(value: any) => setTemplateType(value)}
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
              <p className="text-sm text-muted-foreground">
                You'll be redirected to the appropriate builder to create the {templateType.replace('_template', '').replace('pipeline', 'workflow')} content
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
                    required
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
                data-testid="button-continue"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Continue to Builder
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
    </div>
  );
}

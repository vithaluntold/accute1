import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Plus, Search, Edit, Trash2, Eye, Clock, CheckCircle, FileText, Wrench, Sparkles,
  MessageSquare, Star, Calendar, Briefcase, HeadphonesIcon, ShoppingCart, Mail, DollarSign, UserPlus,
  List, BarChart3, Share2, Copy, Download, Link2, Settings, Lock, Users, CalendarDays, Hash, StickyNote
} from "lucide-react";
import { GradientHero } from "@/components/gradient-hero";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFormTemplateSchema, type FormTemplate, type FormShareLink, type Client, type InstalledAgentView } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import { formTemplates, templateCategories, type FormTemplate as TemplateType } from "@/data/form-templates";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Only user-editable fields
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.enum(["custom", "tax", "audit", "onboarding"]).default("custom"),
});

type FormValues = z.infer<typeof formSchema>;

// Icon mapping for templates
const iconMap: Record<string, any> = {
  MessageSquare,
  Star,
  Calendar,
  Briefcase,
  HeadphonesIcon,
  ShoppingCart,
  Mail,
  DollarSign,
  FileText,
  UserPlus,
};

export default function FormsPage() {
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<FormTemplate | null>(null);
  const [deleteConfirmForm, setDeleteConfirmForm] = useState<FormTemplate | null>(null);
  const [shareDialogForm, setShareDialogForm] = useState<FormTemplate | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [shareLinkSettings, setShareLinkSettings] = useState({
    clientId: "",
    password: "",
    enablePassword: false,
    expiresAt: undefined as Date | undefined,
    maxSubmissions: "",
    dueDate: undefined as Date | undefined,
    notes: "",
  });
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Check for marketplace template ID and metadata in URL
  const params = new URLSearchParams(location.split('?')[1]);
  const marketplaceTemplateId = params.get('marketplaceTemplateId');
  const marketplaceName = params.get('name');
  const marketplaceDescription = params.get('description');
  const marketplaceCategory = params.get('category');
  
  // Open create dialog if coming from marketplace (only once)
  useEffect(() => {
    if (marketplaceTemplateId && !createDialogOpen) {
      setCreateDialogOpen(true);
      // Clear query param immediately to prevent reopening (replace history to avoid Back button loop)
      setLocation('/forms', { replace: true });
    }
  }, [marketplaceTemplateId, createDialogOpen, setLocation]);
  const { toast } = useToast();

  const { data: forms = [], isLoading } = useQuery<FormTemplate[]>({
    queryKey: ["/api/forms"],
  });

  // Check if Forma copilot is installed
  const { data: installedAgents = [] } = useQuery<InstalledAgentView[]>({
    queryKey: ['/api/ai-agents/installed'],
  });

  const hasForma = installedAgents.some((agent) => agent.agent?.name === 'Forma');

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: shareLinks = [], refetch: refetchShareLinks } = useQuery<FormShareLink[]>({
    queryKey: ["/api/forms", shareDialogForm?.id, "share-links"],
    enabled: !!shareDialogForm,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("POST", "/api/forms", data);
      return res.json();
    },
    onSuccess: async (createdForm) => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      
      // Link to marketplace template if ID provided
      if (marketplaceTemplateId) {
        try {
          await apiRequest("PATCH", `/api/marketplace/items/${marketplaceTemplateId}`, {
            sourceId: createdForm.id
          });
          toast({ 
            title: "Success", 
            description: "Form created and linked to marketplace" 
          });
        } catch (error: any) {
          toast({ 
            title: "Warning", 
            description: "Form created but failed to link to marketplace",
            variant: "destructive"
          });
        }
      } else {
        toast({ title: "Form created successfully" });
      }
      
      setCreateDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create form", description: error.message, variant: "destructive" });
    },
  });

  const createFromTemplateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/forms", data),
    onSuccess: (data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      setTemplateGalleryOpen(false);
      const templateName = variables.templateName;
      toast({ 
        title: "Form created from template",
        description: `${templateName} template has been applied`,
      });
      if (data && data.id) {
        setLocation(`/forms/${data.id}/builder`);
      }
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create form from template", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FormValues> }) =>
      apiRequest("PUT", `/api/forms/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      setEditingForm(null);
      toast({ title: "Form updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update form", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/forms/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      setDeleteConfirmForm(null);
      toast({ title: "Form deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete form", description: error.message, variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/forms/${id}/publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      toast({ title: "Form published successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to publish form", description: error.message, variant: "destructive" });
    },
  });

  const createShareLinkMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/forms/${shareDialogForm?.id}/share-links`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms", shareDialogForm?.id, "share-links"] });
      refetchShareLinks();
      toast({ title: "Share link created successfully" });
      setShareLinkSettings({
        clientId: "",
        password: "",
        enablePassword: false,
        expiresAt: undefined,
        maxSubmissions: "",
        dueDate: undefined,
        notes: "",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create share link", description: error.message, variant: "destructive" });
    },
  });

  const deleteShareLinkMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/share-links/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms", shareDialogForm?.id, "share-links"] });
      refetchShareLinks();
      toast({ title: "Share link deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete share link", description: error.message, variant: "destructive" });
    },
  });

  // Generate QR code when share links change
  useEffect(() => {
    if (shareLinks.length > 0 && qrCanvasRef.current) {
      const firstLink = shareLinks[0];
      const url = `${window.location.origin}/public/${firstLink.shareToken}`;
      QRCode.toCanvas(qrCanvasRef.current, url, { width: 200 }, (error) => {
        if (error) console.error("QR Code generation error:", error);
      });
      setQrCodeUrl(url);
    }
  }, [shareLinks]);

  const handleCreateShareLink = () => {
    const data: any = {
      clientId: shareLinkSettings.clientId && shareLinkSettings.clientId !== "none" ? shareLinkSettings.clientId : null,
      password: shareLinkSettings.enablePassword ? shareLinkSettings.password : null,
      expiresAt: shareLinkSettings.expiresAt?.toISOString(),
      maxSubmissions: shareLinkSettings.maxSubmissions ? parseInt(shareLinkSettings.maxSubmissions) : null,
      dueDate: shareLinkSettings.dueDate?.toISOString(),
      notes: shareLinkSettings.notes || null,
    };
    createShareLinkMutation.mutate(data);
  };

  const handleCopyLink = (shareToken: string) => {
    const url = `${window.location.origin}/public/${shareToken}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied to clipboard" });
  };

  const handleDownloadQR = () => {
    if (qrCanvasRef.current) {
      const url = qrCanvasRef.current.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `form-qr-${shareDialogForm?.name}.png`;
      link.href = url;
      link.click();
      toast({ title: "QR code downloaded" });
    }
  };

  const filteredForms = forms.filter((form) =>
    form.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (form.description?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={FileText}
        title={
          <>
            Forms
            {hasForma && (
              <Badge variant="secondary" className="gap-1 bg-white/20 border-white/30 text-white backdrop-blur-sm ml-3" data-testid="badge-forma-copilot">
                <Sparkles className="w-4 h-4" />
                Forma AI
              </Badge>
            )}
          </>
        }
        description="Create and manage form templates for clients and workflows"
        actions={
          <>
            {hasForma && (
              <Button 
                variant="outline" 
                className="bg-white/20 border-white/30 text-white backdrop-blur-sm" 
                data-testid="button-forma-chat"
                onClick={() => setLocation('/ai-agents/forma')}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Ask Forma AI
              </Button>
            )}
            <Button 
              variant="outline" 
              className="bg-white/20 border-white/30 text-white backdrop-blur-sm"
              onClick={() => setTemplateGalleryOpen(true)} 
              data-testid="button-create-from-template"
            >
              <Sparkles className="w-4 w-4 mr-2" />
              Create from Template
            </Button>
            <Button 
              className="bg-white text-primary"
              onClick={() => setCreateDialogOpen(true)} 
              data-testid="button-create-form"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Form
            </Button>
          </>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search forms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-forms"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted rounded w-full mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : filteredForms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? "No forms found" : "No forms yet. Create your first form to get started."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredForms.map((form) => (
            <Card key={form.id} className="hover-elevate" data-testid={`card-form-${form.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="truncate" data-testid={`text-form-name-${form.id}`}>
                        {form.name}
                      </CardTitle>
                      {form.scope === 'global' && (
                        <Badge variant="secondary" className="text-xs" data-testid={`form-scope-${form.id}`}>
                          Global
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="mt-1 line-clamp-2">
                      {form.description || "No description"}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={form.status === "published" ? "default" : "secondary"}
                    data-testid={`badge-status-${form.id}`}
                  >
                    {form.status === "published" ? (
                      <CheckCircle className="w-3 h-3 mr-1" />
                    ) : (
                      <Clock className="w-3 h-3 mr-1" />
                    )}
                    {form.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Category:</span>
                    <Badge variant="outline">{form.category}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Submissions:</span>
                    <span className="font-medium">{form.submissionCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Version:</span>
                    <span className="font-medium">v{form.version}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setLocation(`/forms/${form.id}/builder`)}
                  data-testid={`button-build-form-${form.id}`}
                >
                  <Wrench className="w-3 h-3 mr-1" />
                  Build
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation(`/forms/${form.id}/preview`)}
                  data-testid={`button-preview-form-${form.id}`}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation(`/forms/${form.id}/submissions`)}
                  data-testid={`button-view-submissions-${form.id}`}
                >
                  <List className="w-3 h-3 mr-1" />
                  Submissions
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation(`/forms/${form.id}/analytics`)}
                  data-testid={`button-analytics-${form.id}`}
                >
                  <BarChart3 className="w-3 h-3 mr-1" />
                  Analytics
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShareDialogForm(form)}
                  data-testid={`button-share-form-${form.id}`}
                >
                  <Share2 className="w-3 h-3 mr-1" />
                  Share
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingForm(form)}
                  data-testid={`button-edit-form-${form.id}`}
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                {form.status === "draft" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => publishMutation.mutate(form.id)}
                    disabled={publishMutation.isPending}
                    data-testid={`button-publish-form-${form.id}`}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Publish
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteConfirmForm(form)}
                  data-testid={`button-delete-form-${form.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <FormDialog
        open={createDialogOpen || editingForm !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditingForm(null);
          }
        }}
        form={editingForm}
        marketplaceMetadata={{
          name: marketplaceName || undefined,
          description: marketplaceDescription || undefined,
          category: marketplaceCategory || undefined,
        }}
        onSubmit={(data) => {
          if (editingForm) {
            updateMutation.mutate({ id: editingForm.id, data });
          } else {
            // Backend will set default fields
            createMutation.mutate(data);
          }
        }}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      <Dialog open={deleteConfirmForm !== null} onOpenChange={(open) => !open && setDeleteConfirmForm(null)}>
        <DialogContent data-testid="dialog-delete-form">
          <DialogHeader>
            <DialogTitle>Delete Form</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirmForm?.name}"? This action cannot be undone and will
              also delete all submissions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmForm(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmForm && deleteMutation.mutate(deleteConfirmForm.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TemplateGalleryDialog
        open={templateGalleryOpen}
        onOpenChange={setTemplateGalleryOpen}
        onSelectTemplate={(template) => {
          const categoryMap: Record<string, "custom" | "tax" | "audit" | "onboarding"> = {
            "Business": "custom",
            "Survey": "custom",
            "Registration": "onboarding",
            "Marketing": "custom",
            "Tax": "tax",
            "Onboarding": "onboarding",
          };
          
          createFromTemplateMutation.mutate({
            name: template.name,
            description: template.description,
            category: categoryMap[template.category] || "custom",
            fields: template.fields,
            sections: [],
            pages: [],
            conditionalRules: [],
            validationRules: [],
            calculatedFields: [],
            folderStructure: {},
            settings: template.config,
            templateName: template.name,
          });
        }}
        isPending={createFromTemplateMutation.isPending}
      />

      {/* Share Dialog */}
      <Dialog 
        open={shareDialogForm !== null} 
        onOpenChange={(open) => !open && setShareDialogForm(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-share-form">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Form: {shareDialogForm?.name}
            </DialogTitle>
            <DialogDescription>
              Create secure share links for clients to access and submit this form
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="link" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="link" data-testid="tab-link">
                <Link2 className="w-4 h-4 mr-2" />
                Link
              </TabsTrigger>
              <TabsTrigger value="settings" data-testid="tab-settings">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="link" className="space-y-4 mt-4">
              {shareLinks.length > 0 ? (
                <>
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Shareable Link</Label>
                        <Badge variant="outline" data-testid="badge-link-status">
                          {shareLinks[0].status}
                        </Badge>
                      </div>

                      <div className="flex gap-2">
                        <Input
                          value={qrCodeUrl}
                          readOnly
                          className="font-mono text-sm"
                          data-testid="input-share-url"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleCopyLink(shareLinks[0].shareToken)}
                          data-testid="button-copy-link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-center p-4">
                        <div className="border rounded-lg p-4">
                          <canvas ref={qrCanvasRef} data-testid="canvas-qr-code" />
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        onClick={handleDownloadQR}
                        className="w-full"
                        data-testid="button-download-qr"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download QR Code
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Existing Share Links</Label>
                      <div className="space-y-2">
                        {shareLinks.map((link) => (
                          <Card key={link.id} className="p-3">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-2">
                                  <code className="text-xs bg-muted px-2 py-1 rounded truncate">
                                    {link.shareToken}
                                  </code>
                                  {link.password && <Lock className="h-3 w-3 text-muted-foreground" />}
                                </div>
                                <div className="text-xs text-muted-foreground space-y-0.5">
                                  <div>Views: {link.viewCount} | Submissions: {link.submissionCount}</div>
                                  {link.expiresAt && (
                                    <div>Expires: {new Date(link.expiresAt).toLocaleDateString()}</div>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteShareLinkMutation.mutate(link.id)}
                                disabled={deleteShareLinkMutation.isPending}
                                data-testid={`button-delete-link-${link.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Share2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No share links created yet.</p>
                  <p className="text-sm">Go to Settings tab to create your first share link.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="client-select" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Client (Optional)
                  </Label>
                  <Select
                    value={shareLinkSettings.clientId}
                    onValueChange={(value) =>
                      setShareLinkSettings({ ...shareLinkSettings, clientId: value })
                    }
                  >
                    <SelectTrigger id="client-select" data-testid="select-client">
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific client</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due-date" className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Due Date (Optional)
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !shareLinkSettings.dueDate && "text-muted-foreground"
                        )}
                        data-testid="button-due-date"
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {shareLinkSettings.dueDate ? (
                          format(shareLinkSettings.dueDate, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={shareLinkSettings.dueDate}
                        onSelect={(date) =>
                          setShareLinkSettings({ ...shareLinkSettings, dueDate: date })
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password-toggle" className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Password Protection
                    </Label>
                    <Switch
                      id="password-toggle"
                      checked={shareLinkSettings.enablePassword}
                      onCheckedChange={(checked) =>
                        setShareLinkSettings({ ...shareLinkSettings, enablePassword: checked })
                      }
                      data-testid="switch-password-protection"
                    />
                  </div>
                  {shareLinkSettings.enablePassword && (
                    <Input
                      type="password"
                      placeholder="Enter password"
                      value={shareLinkSettings.password}
                      onChange={(e) =>
                        setShareLinkSettings({ ...shareLinkSettings, password: e.target.value })
                      }
                      data-testid="input-password"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expires-at" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Expiration Date (Optional)
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !shareLinkSettings.expiresAt && "text-muted-foreground"
                        )}
                        data-testid="button-expiration-date"
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        {shareLinkSettings.expiresAt ? (
                          format(shareLinkSettings.expiresAt, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={shareLinkSettings.expiresAt}
                        onSelect={(date) =>
                          setShareLinkSettings({ ...shareLinkSettings, expiresAt: date })
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-submissions" className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Max Submissions (Optional)
                  </Label>
                  <Input
                    id="max-submissions"
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={shareLinkSettings.maxSubmissions}
                    onChange={(e) =>
                      setShareLinkSettings({ ...shareLinkSettings, maxSubmissions: e.target.value })
                    }
                    data-testid="input-max-submissions"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="flex items-center gap-2">
                    <StickyNote className="h-4 w-4" />
                    Notes (Internal)
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder="Internal notes about this share link..."
                    value={shareLinkSettings.notes}
                    onChange={(e) =>
                      setShareLinkSettings({ ...shareLinkSettings, notes: e.target.value })
                    }
                    data-testid="textarea-notes"
                  />
                </div>

                <Button
                  onClick={handleCreateShareLink}
                  disabled={createShareLinkMutation.isPending}
                  className="w-full"
                  data-testid="button-create-share-link"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Create Share Link
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

interface TemplateGalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: TemplateType) => void;
  isPending: boolean;
}

function TemplateGalleryDialog({ open, onOpenChange, onSelectTemplate, isPending }: TemplateGalleryDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTemplates = formTemplates.filter((template) => {
    const matchesCategory = selectedCategory === "All" || template.category === selectedCategory;
    const matchesSearch = 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="dialog-template-gallery">
        <DialogHeader>
          <DialogTitle>Create from Template</DialogTitle>
          <DialogDescription>
            Choose a pre-built template to get started quickly
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-templates"
            />
          </div>

          <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto" data-testid="tabs-template-categories">
              {templateCategories.map((category) => (
                <TabsTrigger 
                  key={category} 
                  value={category}
                  data-testid={`tab-category-${category.toLowerCase()}`}
                >
                  {category}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4">
              <TabsContent value={selectedCategory} className="mt-0">
                {filteredTemplates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No templates found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
                    {filteredTemplates.map((template) => {
                      const IconComponent = iconMap[template.icon] || FileText;
                      return (
                        <Card 
                          key={template.id} 
                          className="hover-elevate flex flex-col"
                          data-testid={`template-card-${template.id}`}
                        >
                          <CardHeader className="flex-1">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-md bg-primary/10">
                                <IconComponent className="w-5 h-5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-base truncate">
                                  {template.name}
                                </CardTitle>
                                <Badge variant="outline" className="mt-1">
                                  {template.category}
                                </Badge>
                              </div>
                            </div>
                            <CardDescription className="line-clamp-3 mt-2">
                              {template.description}
                            </CardDescription>
                          </CardHeader>
                          <CardFooter>
                            <Button
                              size="sm"
                              onClick={() => onSelectTemplate(template)}
                              disabled={isPending}
                              className="w-full"
                              data-testid={`button-use-template-${template.id}`}
                            >
                              Use Template
                            </Button>
                          </CardFooter>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: FormTemplate | null;
  marketplaceMetadata?: {
    name?: string;
    description?: string;
    category?: string;
  };
  onSubmit: (data: FormValues) => void;
  isPending: boolean;
}

function FormDialog({ open, onOpenChange, form, marketplaceMetadata, onSubmit, isPending }: FormDialogProps) {
  const formHook = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "custom",
    },
  });

  // Reset form when dialog opens/closes or form data changes
  useEffect(() => {
    if (open) {
      // Pre-fill with marketplace metadata when creating new form
      if (!form && marketplaceMetadata) {
        // Map marketplace category to form category enum
        const validCategories: readonly ("custom" | "tax" | "audit" | "onboarding")[] = ["custom", "tax", "audit", "onboarding"];
        const category: "custom" | "tax" | "audit" | "onboarding" = validCategories.includes(marketplaceMetadata.category as any) 
          ? (marketplaceMetadata.category as "custom" | "tax" | "audit" | "onboarding")
          : "custom";
        
        const resetData: { name: string; description: string; category: "custom" | "tax" | "audit" | "onboarding" } = {
          name: marketplaceMetadata.name || "",
          description: marketplaceMetadata.description || "",
          category,
        };
        
        formHook.reset(resetData);
      } else {
        // Use existing form data when editing
        const category: "custom" | "tax" | "audit" | "onboarding" = 
          (form?.category as "custom" | "tax" | "audit" | "onboarding") || "custom";
        
        formHook.reset({
          name: form?.name || "",
          description: form?.description || "",
          category,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form, marketplaceMetadata]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-form-editor">
        <DialogHeader>
          <DialogTitle>{form ? "Edit Form" : "Create Form"}</DialogTitle>
          <DialogDescription>
            {form ? "Update form details" : "Create a new form template"}
          </DialogDescription>
        </DialogHeader>
        <Form {...formHook}>
          <form onSubmit={formHook.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={formHook.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Tax Return Form 2024" {...field} data-testid="input-form-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={formHook.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what this form is for..."
                      {...field}
                      value={field.value || ""}
                      data-testid="input-form-description"
                    />
                  </FormControl>
                  <FormDescription>
                    Help users understand when to use this form
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={formHook.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-form-category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="custom">Custom</SelectItem>
                      <SelectItem value="tax">Tax</SelectItem>
                      <SelectItem value="audit">Audit</SelectItem>
                      <SelectItem value="onboarding">Onboarding</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-form"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-form">
                {form ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

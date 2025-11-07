import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { GradientHero } from "@/components/gradient-hero";
import { Plus, Edit, Trash2, Package, Tag, DollarSign } from "lucide-react";
import type { ProductFamily, PlanSKU, PlanAddon } from "@shared/schema";

export default function PricingManagementPage() {
  const [activeTab, setActiveTab] = useState("families");
  
  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={DollarSign}
        title="Pricing Management"
        description="Manage product families, plan SKUs, and add-ons for the platform"
      />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="families" data-testid="tab-families">
              <Package className="h-4 w-4 mr-2" />
              Product Families
            </TabsTrigger>
            <TabsTrigger value="skus" data-testid="tab-skus">
              <Tag className="h-4 w-4 mr-2" />
              Plan SKUs
            </TabsTrigger>
            <TabsTrigger value="addons" data-testid="tab-addons">
              <Plus className="h-4 w-4 mr-2" />
              Add-ons
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="families" className="mt-6">
            <ProductFamiliesTab />
          </TabsContent>
          
          <TabsContent value="skus" className="mt-6">
            <PlanSKUsTab />
          </TabsContent>
          
          <TabsContent value="addons" className="mt-6">
            <PlanAddonsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ============================================
// PRODUCT FAMILIES TAB
// ============================================

function ProductFamiliesTab() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingFamily, setEditingFamily] = useState<ProductFamily | null>(null);
  
  const { data: families = [], isLoading } = useQuery<ProductFamily[]>({
    queryKey: ["/api/pricing/product-families"],
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/pricing/product-families/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/product-families"] });
      toast({ title: "Product family deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to delete product family",
        description: error.message,
      });
    },
  });
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading product families...</div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Product Families</CardTitle>
          <CardDescription>Manage product families that bundle features together</CardDescription>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-family">
              <Plus className="h-4 w-4 mr-2" />
              Create Family
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <ProductFamilyForm
              onSuccess={() => {
                setShowCreateDialog(false);
                toast({ title: "Product family created successfully" });
              }}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {families.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No product families yet. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              families.map((family) => (
                <TableRow key={family.id} data-testid={`row-family-${family.id}`}>
                  <TableCell className="font-medium">{family.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">{family.slug}</code>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{family.description}</TableCell>
                  <TableCell>{family.displayOrder}</TableCell>
                  <TableCell>
                    <Badge variant={family.isActive ? "default" : "secondary"}>
                      {family.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog onOpenChange={(open) => !open && setEditingFamily(null)}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          data-testid={`button-edit-family-${family.id}`}
                          onClick={() => setEditingFamily(family)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <ProductFamilyForm
                          family={editingFamily}
                          onSuccess={() => {
                            setEditingFamily(null);
                            toast({ title: "Product family updated successfully" });
                          }}
                        />
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid={`button-delete-family-${family.id}`}
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this product family?")) {
                          deleteMutation.mutate(family.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ProductFamilyForm({ family, onSuccess }: { family?: ProductFamily | null; onSuccess: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: family?.name || "",
    slug: family?.slug || "",
    description: family?.description || "",
    displayOrder: family?.displayOrder || 0,
    features: family?.features?.join("\n") || "",
    icon: family?.icon || "",
    color: family?.color || "",
    isActive: family?.isActive ?? true,
  });
  
  // Sync form data when family prop changes (for both create and edit modes)
  useEffect(() => {
    setFormData({
      name: family?.name || "",
      slug: family?.slug || "",
      description: family?.description || "",
      displayOrder: family?.displayOrder || 0,
      features: family?.features?.join("\n") || "",
      icon: family?.icon || "",
      color: family?.color || "",
      isActive: family?.isActive ?? true,
    });
  }, [family]);
  
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const url = family 
        ? `/api/pricing/product-families/${family.id}`
        : "/api/pricing/product-families";
      const method = family ? "PATCH" : "POST";
      
      return apiRequest(url, method, {
        ...data,
        features: data.features ? data.features.split("\n").filter(Boolean) : [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/product-families"] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to save product family",
        description: error.message,
      });
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{family ? "Edit Product Family" : "Create Product Family"}</DialogTitle>
        <DialogDescription>
          Configure the product family details and features
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4 my-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              data-testid="input-family-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="slug">Slug *</Label>
            <Input
              id="slug"
              data-testid="input-family-slug"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="e.g., core-accounting"
              required
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            data-testid="input-family-description"
            value={formData.description || ""}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
          />
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="displayOrder">Display Order</Label>
            <Input
              id="displayOrder"
              type="number"
              data-testid="input-family-order"
              value={formData.displayOrder}
              onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) })}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="icon">Icon</Label>
            <Input
              id="icon"
              data-testid="input-family-icon"
              value={formData.icon || ""}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              placeholder="e.g., package"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <Input
              id="color"
              data-testid="input-family-color"
              value={formData.color || ""}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              placeholder="e.g., #3B82F6"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="features">Features (one per line)</Label>
          <Textarea
            id="features"
            data-testid="input-family-features"
            value={formData.features}
            onChange={(e) => setFormData({ ...formData, features: e.target.value })}
            rows={4}
            placeholder="Unlimited workflows&#10;Advanced AI agents&#10;Priority support"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="isActive"
            data-testid="switch-family-active"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
          />
          <Label htmlFor="isActive">Active</Label>
        </div>
      </div>
      
      <DialogFooter>
        <Button type="submit" data-testid="button-save-family" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : family ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ============================================
// PLAN SKUs TAB
// ============================================

function PlanSKUsTab() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSKU, setEditingSKU] = useState<PlanSKU | null>(null);
  
  const { data: skus = [], isLoading } = useQuery<PlanSKU[]>({
    queryKey: ["/api/pricing/skus"],
  });
  
  const { data: families = [] } = useQuery<ProductFamily[]>({
    queryKey: ["/api/pricing/product-families"],
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/pricing/skus/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/skus"] });
      toast({ title: "Plan SKU deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to delete plan SKU",
        description: error.message,
      });
    },
  });
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading plan SKUs...</div>
        </CardContent>
      </Card>
    );
  }
  
  const formatPrice = (price?: number) => {
    if (!price) return "N/A";
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
  };
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Plan SKUs</CardTitle>
          <CardDescription>Manage pricing models for subscription plans</CardDescription>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-sku">
              <Plus className="h-4 w-4 mr-2" />
              Create SKU
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <PlanSKUForm
              families={families}
              onSuccess={() => {
                setShowCreateDialog(false);
                toast({ title: "Plan SKU created successfully" });
              }}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Cycle</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {skus.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No plan SKUs yet. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              skus.map((sku) => (
                <TableRow key={sku.id} data-testid={`row-sku-${sku.id}`}>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">{sku.sku}</code>
                  </TableCell>
                  <TableCell className="font-medium">{sku.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{sku.pricingModel}</Badge>
                  </TableCell>
                  <TableCell>{formatPrice(sku.fixedPrice || sku.basePrice)}</TableCell>
                  <TableCell>{sku.billingCycle || "N/A"}</TableCell>
                  <TableCell>{sku.regionCode}</TableCell>
                  <TableCell>
                    <Badge variant={sku.isActive ? "default" : "secondary"}>
                      {sku.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog onOpenChange={(open) => !open && setEditingSKU(null)}>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-edit-sku-${sku.id}`}
                          onClick={() => setEditingSKU(sku)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <PlanSKUForm
                          sku={editingSKU}
                          families={families}
                          onSuccess={() => {
                            setEditingSKU(null);
                            toast({ title: "Plan SKU updated successfully" });
                          }}
                        />
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid={`button-delete-sku-${sku.id}`}
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this plan SKU?")) {
                          deleteMutation.mutate(sku.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PlanSKUForm({ sku, families, onSuccess }: { sku?: PlanSKU | null; families: ProductFamily[]; onSuccess: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    productFamilyId: sku?.productFamilyId || "",
    planId: sku?.planId || "",
    sku: sku?.sku || "",
    name: sku?.name || "",
    description: sku?.description || "",
    pricingModel: sku?.pricingModel || "fixed" as const,
    fixedPrice: sku?.fixedPrice || 0,
    usageUnit: sku?.usageUnit || "",
    usagePrice: sku?.usagePrice || 0,
    includedUsage: sku?.includedUsage || 0,
    basePrice: sku?.basePrice || 0,
    regionCode: sku?.regionCode || "US",
    currency: sku?.currency || "USD",
    billingCycle: sku?.billingCycle || "monthly" as const,
    isActive: sku?.isActive ?? true,
  });
  
  // Sync form data when sku prop changes (for both create and edit modes)
  useEffect(() => {
    setFormData({
      productFamilyId: sku?.productFamilyId || "",
      planId: sku?.planId || "",
      sku: sku?.sku || "",
      name: sku?.name || "",
      description: sku?.description || "",
      pricingModel: sku?.pricingModel || "fixed" as const,
      fixedPrice: sku?.fixedPrice || 0,
      usageUnit: sku?.usageUnit || "",
      usagePrice: sku?.usagePrice || 0,
      includedUsage: sku?.includedUsage || 0,
      basePrice: sku?.basePrice || 0,
      regionCode: sku?.regionCode || "US",
      currency: sku?.currency || "USD",
      billingCycle: sku?.billingCycle || "monthly" as const,
      isActive: sku?.isActive ?? true,
    });
  }, [sku]);
  
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const url = sku ? `/api/pricing/skus/${sku.id}` : "/api/pricing/skus";
      const method = sku ? "PATCH" : "POST";
      return apiRequest(url, method, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/skus"] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to save plan SKU",
        description: error.message,
      });
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{sku ? "Edit Plan SKU" : "Create Plan SKU"}</DialogTitle>
        <DialogDescription>
          Configure pricing model and details for a subscription plan
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4 my-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="productFamilyId">Product Family *</Label>
            <Select
              value={formData.productFamilyId}
              onValueChange={(value) => setFormData({ ...formData, productFamilyId: value })}
            >
              <SelectTrigger data-testid="select-sku-family">
                <SelectValue placeholder="Select family" />
              </SelectTrigger>
              <SelectContent>
                {families.map((family) => (
                  <SelectItem key={family.id} value={family.id}>
                    {family.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="sku">SKU Code *</Label>
            <Input
              id="sku"
              data-testid="input-sku-code"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              placeholder="e.g., CORE-MONTHLY-US"
              required
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            data-testid="input-sku-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            data-testid="input-sku-description"
            value={formData.description || ""}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
          />
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="pricingModel">Pricing Model *</Label>
            <Select
              value={formData.pricingModel}
              onValueChange={(value: any) => setFormData({ ...formData, pricingModel: value })}
            >
              <SelectTrigger data-testid="select-pricing-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed</SelectItem>
                <SelectItem value="usage_based">Usage Based</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
                <SelectItem value="tiered">Tiered</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="billingCycle">Billing Cycle</Label>
            <Select
              value={formData.billingCycle}
              onValueChange={(value: any) => setFormData({ ...formData, billingCycle: value })}
            >
              <SelectTrigger data-testid="select-billing-cycle">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="fixedPrice">Price</Label>
            <Input
              id="fixedPrice"
              type="number"
              step="0.01"
              data-testid="input-sku-price"
              value={formData.fixedPrice}
              onChange={(e) => setFormData({ ...formData, fixedPrice: parseFloat(e.target.value) })}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="regionCode">Region Code</Label>
            <Input
              id="regionCode"
              data-testid="input-region-code"
              value={formData.regionCode}
              onChange={(e) => setFormData({ ...formData, regionCode: e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              data-testid="input-currency"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="isActive"
            data-testid="switch-sku-active"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
          />
          <Label htmlFor="isActive">Active</Label>
        </div>
      </div>
      
      <DialogFooter>
        <Button type="submit" data-testid="button-save-sku" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : sku ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ============================================
// PLAN ADD-ONS TAB
// ============================================

function PlanAddonsTab() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingAddon, setEditingAddon] = useState<PlanAddon | null>(null);
  
  const { data: addons = [], isLoading } = useQuery<PlanAddon[]>({
    queryKey: ["/api/pricing/addons"],
  });
  
  const { data: families = [] } = useQuery<ProductFamily[]>({
    queryKey: ["/api/pricing/product-families"],
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/pricing/addons/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/addons"] });
      toast({ title: "Add-on deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to delete add-on",
        description: error.message,
      });
    },
  });
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading add-ons...</div>
        </CardContent>
      </Card>
    );
  }
  
  const formatPrice = (price?: number) => {
    if (!price) return "N/A";
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
  };
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Plan Add-ons</CardTitle>
          <CardDescription>Manage optional add-on features for subscription plans</CardDescription>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-addon">
              <Plus className="h-4 w-4 mr-2" />
              Create Add-on
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <PlanAddonForm
              families={families}
              onSuccess={() => {
                setShowCreateDialog(false);
                toast({ title: "Add-on created successfully" });
              }}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Monthly</TableHead>
              <TableHead>Yearly</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {addons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No add-ons yet. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              addons.map((addon) => (
                <TableRow key={addon.id} data-testid={`row-addon-${addon.id}`}>
                  <TableCell className="font-medium">{addon.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">{addon.slug}</code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{addon.pricingModel}</Badge>
                  </TableCell>
                  <TableCell>{formatPrice(addon.priceMonthly)}</TableCell>
                  <TableCell>{formatPrice(addon.priceYearly)}</TableCell>
                  <TableCell>
                    <Badge variant={addon.isActive ? "default" : "secondary"}>
                      {addon.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog onOpenChange={(open) => !open && setEditingAddon(null)}>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-edit-addon-${addon.id}`}
                          onClick={() => setEditingAddon(addon)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <PlanAddonForm
                          addon={editingAddon}
                          families={families}
                          onSuccess={() => {
                            setEditingAddon(null);
                            toast({ title: "Add-on updated successfully" });
                          }}
                        />
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid={`button-delete-addon-${addon.id}`}
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this add-on?")) {
                          deleteMutation.mutate(addon.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PlanAddonForm({ addon, families, onSuccess }: { addon?: PlanAddon | null; families: ProductFamily[]; onSuccess: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    productFamilyId: addon?.productFamilyId || "",
    name: addon?.name || "",
    slug: addon?.slug || "",
    description: addon?.description || "",
    pricingModel: addon?.pricingModel || "fixed" as const,
    priceMonthly: addon?.priceMonthly || 0,
    priceYearly: addon?.priceYearly || 0,
    unit: addon?.unit || "",
    pricePerUnit: addon?.pricePerUnit || 0,
    minQuantity: addon?.minQuantity || 1,
    maxQuantity: addon?.maxQuantity,
    features: addon?.features?.join("\n") || "",
    displayOrder: addon?.displayOrder || 0,
    isActive: addon?.isActive ?? true,
  });
  
  // Sync form data when addon prop changes (for both create and edit modes)
  useEffect(() => {
    setFormData({
      productFamilyId: addon?.productFamilyId || "",
      name: addon?.name || "",
      slug: addon?.slug || "",
      description: addon?.description || "",
      pricingModel: addon?.pricingModel || "fixed" as const,
      priceMonthly: addon?.priceMonthly || 0,
      priceYearly: addon?.priceYearly || 0,
      unit: addon?.unit || "",
      pricePerUnit: addon?.pricePerUnit || 0,
      minQuantity: addon?.minQuantity || 1,
      maxQuantity: addon?.maxQuantity,
      features: addon?.features?.join("\n") || "",
      displayOrder: addon?.displayOrder || 0,
      isActive: addon?.isActive ?? true,
    });
  }, [addon]);
  
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const url = addon ? `/api/pricing/addons/${addon.id}` : "/api/pricing/addons";
      const method = addon ? "PATCH" : "POST";
      
      return apiRequest(url, method, {
        ...data,
        features: data.features ? data.features.split("\n").filter(Boolean) : [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/addons"] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to save add-on",
        description: error.message,
      });
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{addon ? "Edit Add-on" : "Create Add-on"}</DialogTitle>
        <DialogDescription>
          Configure optional features that organizations can add to their subscription
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4 my-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="productFamilyId">Product Family *</Label>
            <Select
              value={formData.productFamilyId}
              onValueChange={(value) => setFormData({ ...formData, productFamilyId: value })}
            >
              <SelectTrigger data-testid="select-addon-family">
                <SelectValue placeholder="Select family" />
              </SelectTrigger>
              <SelectContent>
                {families.map((family) => (
                  <SelectItem key={family.id} value={family.id}>
                    {family.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="slug">Slug *</Label>
            <Input
              id="slug"
              data-testid="input-addon-slug"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="e.g., extra-storage"
              required
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            data-testid="input-addon-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            data-testid="input-addon-description"
            value={formData.description || ""}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
          />
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="pricingModel">Pricing Model</Label>
            <Select
              value={formData.pricingModel}
              onValueChange={(value: any) => setFormData({ ...formData, pricingModel: value })}
            >
              <SelectTrigger data-testid="select-addon-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed</SelectItem>
                <SelectItem value="per_unit">Per Unit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="priceMonthly">Monthly Price</Label>
            <Input
              id="priceMonthly"
              type="number"
              step="0.01"
              data-testid="input-addon-monthly"
              value={formData.priceMonthly}
              onChange={(e) => setFormData({ ...formData, priceMonthly: parseFloat(e.target.value) })}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="priceYearly">Yearly Price</Label>
            <Input
              id="priceYearly"
              type="number"
              step="0.01"
              data-testid="input-addon-yearly"
              value={formData.priceYearly}
              onChange={(e) => setFormData({ ...formData, priceYearly: parseFloat(e.target.value) })}
            />
          </div>
        </div>
        
        {formData.pricingModel === "per_unit" && (
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                data-testid="input-addon-unit"
                value={formData.unit || ""}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="e.g., GB, users"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="pricePerUnit">Price Per Unit</Label>
              <Input
                id="pricePerUnit"
                type="number"
                step="0.01"
                data-testid="input-addon-per-unit"
                value={formData.pricePerUnit}
                onChange={(e) => setFormData({ ...formData, pricePerUnit: parseFloat(e.target.value) })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="minQuantity">Min Quantity</Label>
              <Input
                id="minQuantity"
                type="number"
                data-testid="input-addon-min"
                value={formData.minQuantity}
                onChange={(e) => setFormData({ ...formData, minQuantity: parseInt(e.target.value) })}
              />
            </div>
          </div>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="features">Features (one per line)</Label>
          <Textarea
            id="features"
            data-testid="input-addon-features"
            value={formData.features}
            onChange={(e) => setFormData({ ...formData, features: e.target.value })}
            rows={3}
            placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="isActive"
            data-testid="switch-addon-active"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
          />
          <Label htmlFor="isActive">Active</Label>
        </div>
      </div>
      
      <DialogFooter>
        <Button type="submit" data-testid="button-save-addon" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : addon ? "Update" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

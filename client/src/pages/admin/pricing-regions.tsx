import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Plus, MoreVertical, Edit, Trash2, Globe, DollarSign, Map } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { GradientHero } from "@/components/gradient-hero";
import {
  PricingRegion,
  pricingRegionFormSchema,
  PricingRegionFormData,
  transformRegionFormData,
  defaultRegionFormValues
} from "@shared/schema";

export default function PricingRegionsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<PricingRegion | null>(null);
  const [deletingRegion, setDeletingRegion] = useState<PricingRegion | null>(null);
  const { toast } = useToast();

  const form = useForm<PricingRegionFormData>({
    resolver: zodResolver(pricingRegionFormSchema),
    defaultValues: defaultRegionFormValues,
  });

  const { data: regions, isLoading } = useQuery<PricingRegion[]>({
    queryKey: ["/api/pricing-regions"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: PricingRegionFormData) => {
      const payload = transformRegionFormData(data);
      return await apiRequest("POST", "/api/pricing-regions", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-regions"] });
      handleCloseDialog();
      toast({ title: "Pricing region created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create region", description: error.message, variant: "destructive" });
      form.setError("root", { message: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PricingRegionFormData }) => {
      const payload = transformRegionFormData(data);
      return await apiRequest("PATCH", `/api/pricing-regions/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-regions"] });
      handleCloseDialog();
      toast({ title: "Pricing region updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update region", description: error.message, variant: "destructive" });
      form.setError("root", { message: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/pricing-regions/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-regions"] });
      setDeletingRegion(null);
      toast({ title: "Pricing region deleted successfully" });
    },
    onError: (error: Error) => {
      setDeletingRegion(null);
      toast({ title: "Failed to delete region", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenDialog = (region?: PricingRegion) => {
    if (region) {
      setEditingRegion(region);
      const countryCodes = Array.isArray(region.countryCodes) ? region.countryCodes as string[] : [];
      form.reset({
        name: region.name,
        code: region.code || "",
        description: region.description || "",
        countryCodes: countryCodes,
        countriesInput: countryCodes.join("\n"),
        currency: region.currency,
        currencySymbol: region.currencySymbol,
        priceMultiplier: region.priceMultiplier,
        isActive: region.isActive,
        displayOrder: region.displayOrder,
      });
    } else {
      setEditingRegion(null);
      form.reset(defaultRegionFormValues);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRegion(null);
    form.reset(defaultRegionFormValues);
  };

  const onSubmit = (data: PricingRegionFormData) => {
    if (editingRegion) {
      updateMutation.mutate({ id: editingRegion.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredRegions = regions?.filter(region =>
    region.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (region.code && region.code.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  const stats = {
    totalRegions: regions?.length || 0,
    activeRegions: regions?.filter(r => r.isActive).length || 0,
    averageMultiplier: regions && regions.length > 0 
      ? (regions.reduce((sum, r) => sum + parseFloat(r.priceMultiplier), 0) / regions.length).toFixed(2)
      : "0.00",
  };

  return (
    <>
      <GradientHero
        icon={Globe}
        title="Pricing Regions"
        description="Manage regional pricing multipliers and currency settings"
      />

      <div className="container mx-auto p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card data-testid="card-total-regions">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Regions</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-regions">{stats.totalRegions}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-active-regions">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Regions</CardTitle>
              <Map className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-active-regions">{stats.activeRegions}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-multiplier">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Multiplier</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-avg-multiplier">{stats.averageMultiplier}x</div>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-regions-list">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <CardTitle>Pricing Regions</CardTitle>
                <CardDescription>Configure country-based pricing adjustments using PPP multipliers</CardDescription>
              </div>
              <Button onClick={() => handleOpenDialog()} data-testid="button-create-region">
                <Plus className="h-4 w-4 mr-2" />
                Create Region
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search regions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-regions"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading regions...</div>
            ) : filteredRegions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No pricing regions found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Region</TableHead>
                    <TableHead>Countries</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Multiplier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegions.map((region) => (
                    <TableRow key={region.id} data-testid={`row-region-${region.id}`}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium" data-testid={`text-region-name-${region.id}`}>{region.name}</div>
                          {region.code && <div className="text-sm text-muted-foreground">{region.code}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {Array.isArray(region.countryCodes) ? region.countryCodes.length : 0} {(Array.isArray(region.countryCodes) ? region.countryCodes.length : 0) === 1 ? 'country' : 'countries'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {region.currency} ({region.currencySymbol})
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" data-testid={`badge-multiplier-${region.id}`}>
                          {region.priceMultiplier}x
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={region.isActive ? "default" : "secondary"}
                          data-testid={`badge-status-${region.id}`}
                        >
                          {region.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-actions-${region.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDialog(region)} data-testid={`menu-edit-${region.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeletingRegion(region)}
                              className="text-destructive"
                              data-testid={`menu-delete-${region.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-region-form">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">{editingRegion ? "Edit Region" : "Create Region"}</DialogTitle>
            <DialogDescription>
              Configure regional pricing multipliers based on purchasing power parity
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Region Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="India & South Asia" {...field} data-testid="input-region-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Region Code</FormLabel>
                      <FormControl>
                        <Input placeholder="IN" {...field} value={field.value || ""} data-testid="input-region-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="South Asian pricing with PPP adjustment..."
                        rows={2}
                        {...field}
                        value={field.value || ""}
                        data-testid="input-region-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="countriesInput"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Countries (one per line) *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="India&#10;Bangladesh&#10;Sri Lanka&#10;Nepal"
                        rows={5}
                        {...field}
                        value={field.value || ""}
                        data-testid="input-countries"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency Code *</FormLabel>
                      <FormControl>
                        <Input placeholder="INR" {...field} data-testid="input-currency" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currencySymbol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency Symbol *</FormLabel>
                      <FormControl>
                        <Input placeholder="₹" {...field} data-testid="input-currency-symbol" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="priceMultiplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price Multiplier (PPP-based) *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.30" {...field} data-testid="input-multiplier" />
                    </FormControl>
                    <p className="text-sm text-muted-foreground">
                      1.0 = no adjustment, 0.3 = 70% discount, 1.5 = 50% premium
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Order *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={field.value || 0}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-display-order"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-is-active"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Active</FormLabel>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit"
                >
                  {editingRegion ? "Update Region" : "Create Region"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingRegion} onOpenChange={(open) => !open && setDeletingRegion(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-delete-title">Delete Pricing Region</AlertDialogTitle>
            <AlertDialogDescription data-testid="text-delete-description">
              Are you sure you want to delete the "{deletingRegion?.name}" region? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingRegion && deleteMutation.mutate(deletingRegion.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-delete-confirm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

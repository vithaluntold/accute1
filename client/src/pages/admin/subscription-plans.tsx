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
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Search, Plus, MoreVertical, Edit, Trash2, DollarSign, Users, Package, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { GradientHero } from "@/components/gradient-hero";
import {
  SubscriptionPlan,
  subscriptionPlanFormSchema,
  SubscriptionPlanFormData,
  transformPlanFormData,
  defaultPlanFormValues
} from "@shared/schema";

interface AIAgent {
  slug: string;
  name: string;
  description: string;
  category: string;
  capabilities: string[];
}

export default function SubscriptionPlansPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<SubscriptionPlan | null>(null);
  const { toast } = useToast();

  const form = useForm<SubscriptionPlanFormData>({
    resolver: zodResolver(subscriptionPlanFormSchema),
    defaultValues: defaultPlanFormValues,
  });

  const { data: plans, isLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans"],
  });

  // Fetch available AI agents
  const { data: aiAgents = [] } = useQuery<AIAgent[]>({
    queryKey: ['/api/marketplace/agents'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: SubscriptionPlanFormData) => {
      const payload = transformPlanFormData(data);
      return await apiRequest("POST", "/api/subscription-plans", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription-plans"] });
      handleCloseDialog();
      toast({ title: "Subscription plan created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create plan", description: error.message, variant: "destructive" });
      form.setError("root", { message: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SubscriptionPlanFormData }) => {
      const payload = transformPlanFormData(data);
      return await apiRequest("PATCH", `/api/subscription-plans/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription-plans"] });
      handleCloseDialog();
      toast({ title: "Subscription plan updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update plan", description: error.message, variant: "destructive" });
      form.setError("root", { message: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/subscription-plans/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription-plans"] });
      setDeletingPlan(null);
      toast({ title: "Subscription plan deleted successfully" });
    },
    onError: (error: Error) => {
      setDeletingPlan(null);
      toast({ title: "Failed to delete plan", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenDialog = (plan?: SubscriptionPlan) => {
    if (plan) {
      setEditingPlan(plan);
      form.reset({
        name: plan.name,
        slug: plan.slug,
        description: plan.description || "",
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        features: plan.features,
        featuresInput: plan.features.join("\n"),
        featureIdentifiers: plan.featureIdentifiers || [],
        maxUsers: plan.maxUsers,
        maxClients: plan.maxClients,
        maxStorage: plan.maxStorage,
        includedSeats: plan.includedSeats,
        additionalSeatPrice: plan.additionalSeatPrice,
        isActive: plan.isActive,
        isFeatured: plan.isFeatured,
        displayOrder: plan.displayOrder,
      });
    } else {
      setEditingPlan(null);
      form.reset(defaultPlanFormValues);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPlan(null);
    form.reset(defaultPlanFormValues);
  };

  const onSubmit = (data: SubscriptionPlanFormData) => {
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredPlans = plans?.filter(plan =>
    plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    plan.slug.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const stats = {
    totalPlans: plans?.length || 0,
    activePlans: plans?.filter(p => p.isActive).length || 0,
    featuredPlans: plans?.filter(p => p.isFeatured).length || 0,
  };

  return (
    <>
      <GradientHero
        icon={Package}
        title="Subscription Plans"
        description="Manage subscription tiers, pricing, features, and limits"
      />

      <div className="container mx-auto p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card data-testid="card-total-plans">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Plans</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-plans">{stats.totalPlans}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-active-plans">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-active-plans">{stats.activePlans}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-featured-plans">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Featured Plans</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-featured-plans">{stats.featuredPlans}</div>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-plans-list">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <CardTitle>Subscription Plans</CardTitle>
                <CardDescription>Configure pricing tiers and feature sets</CardDescription>
              </div>
              <Button onClick={() => handleOpenDialog()} data-testid="button-create-plan">
                <Plus className="h-4 w-4 mr-2" />
                Create Plan
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search plans..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-plans"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading plans...</div>
            ) : filteredPlans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No subscription plans found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Pricing</TableHead>
                    <TableHead>Seats</TableHead>
                    <TableHead>Limits</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlans.map((plan) => (
                    <TableRow key={plan.id} data-testid={`row-plan-${plan.id}`}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium" data-testid={`text-plan-name-${plan.id}`}>{plan.name}</div>
                          <div className="text-sm text-muted-foreground">{plan.slug}</div>
                          {plan.isFeatured && (
                            <Badge variant="default" className="text-xs" data-testid={`badge-featured-${plan.id}`}>
                              Featured
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">${plan.monthlyPrice}/mo</div>
                          <div className="text-sm text-muted-foreground">${plan.yearlyPrice}/yr</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">{plan.includedSeats} included</div>
                          <div className="text-sm text-muted-foreground">
                            +${plan.additionalSeatPrice}/seat
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {plan.maxUsers && <div>Users: {plan.maxUsers}</div>}
                          {plan.maxClients && <div>Clients: {plan.maxClients}</div>}
                          {plan.maxStorage && <div>Storage: {plan.maxStorage}GB</div>}
                          {!plan.maxUsers && !plan.maxClients && !plan.maxStorage && (
                            <span className="text-muted-foreground">Unlimited</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={plan.isActive ? "default" : "secondary"}
                          data-testid={`badge-status-${plan.id}`}
                        >
                          {plan.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-actions-${plan.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDialog(plan)} data-testid={`menu-edit-${plan.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeletingPlan(plan)}
                              className="text-destructive"
                              data-testid={`menu-delete-${plan.id}`}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-plan-form">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">{editingPlan ? "Edit Plan" : "Create Plan"}</DialogTitle>
            <DialogDescription>
              Configure subscription plan details, pricing, and limits
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
                      <FormLabel>Plan Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Professional" {...field} data-testid="input-plan-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug *</FormLabel>
                      <FormControl>
                        <Input placeholder="professional" {...field} data-testid="input-plan-slug" />
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
                        placeholder="Best for growing teams..."
                        rows={2}
                        {...field}
                        value={field.value || ""}
                        data-testid="input-plan-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="monthlyPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Price ($) *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} data-testid="input-monthly-price" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="yearlyPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Yearly Price ($) *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} data-testid="input-yearly-price" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="includedSeats"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Included Seats *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          data-testid="input-included-seats"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="additionalSeatPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Seat Price ($) *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} data-testid="input-additional-seat-price" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="maxUsers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Users</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Unlimited"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          data-testid="input-max-users"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxClients"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Clients</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Unlimited"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          data-testid="input-max-clients"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxStorage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Storage (GB)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Unlimited"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          data-testid="input-max-storage"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="featuresInput"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Features (one per line)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Unlimited projects&#10;Advanced analytics&#10;Priority support"
                        rows={6}
                        {...field}
                        value={field.value || ""}
                        data-testid="input-features"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* AI Agent Bundling */}
              <FormField
                control={form.control}
                name="featureIdentifiers"
                render={({ field }) => (
                  <FormItem>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-primary" />
                        <FormLabel>Bundled AI Agents</FormLabel>
                      </div>
                      <FormDescription>
                        Select AI agents to automatically install for subscribers of this plan
                      </FormDescription>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border rounded-lg p-4">
                        {aiAgents.length === 0 ? (
                          <p className="text-sm text-muted-foreground col-span-2">
                            No AI agents available
                          </p>
                        ) : (
                          aiAgents.map((agent) => (
                            <FormItem
                              key={agent.slug}
                              className="flex items-start space-x-3 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(agent.slug)}
                                  onCheckedChange={(checked) => {
                                    const current = field.value || [];
                                    if (checked) {
                                      field.onChange([...current, agent.slug]);
                                    } else {
                                      field.onChange(current.filter((slug) => slug !== agent.slug));
                                    }
                                  }}
                                  data-testid={`checkbox-agent-${agent.slug}`}
                                />
                              </FormControl>
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                  <label
                                    htmlFor={agent.slug}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                  >
                                    {agent.name}
                                  </label>
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {agent.category}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {agent.description}
                                </p>
                              </div>
                            </FormItem>
                          ))
                        )}
                      </div>
                      <FormMessage />
                    </div>
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

              <div className="flex items-center justify-between">
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
                <FormField
                  control={form.control}
                  name="isFeatured"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-is-featured"
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Featured</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit"
                >
                  {editingPlan ? "Update Plan" : "Create Plan"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingPlan} onOpenChange={(open) => !open && setDeletingPlan(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-delete-title">Delete Subscription Plan</AlertDialogTitle>
            <AlertDialogDescription data-testid="text-delete-description">
              Are you sure you want to delete the "{deletingPlan?.name}" plan? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPlan && deleteMutation.mutate(deletingPlan.id)}
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

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Plus, MoreVertical, Edit, Trash2, Tag, Percent, Gift } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { GradientHero } from "@/components/gradient-hero";
import {
  Coupon,
  couponFormSchema,
  CouponFormData,
  transformCouponFormData,
  defaultCouponFormValues
} from "@shared/schema";

export default function CouponsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [deletingCoupon, setDeletingCoupon] = useState<Coupon | null>(null);
  const { toast } = useToast();

  const form = useForm<CouponFormData>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: defaultCouponFormValues,
  });

  const { data: coupons, isLoading } = useQuery<Coupon[]>({
    queryKey: ["/api/coupons"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: CouponFormData) => {
      const payload = transformCouponFormData(data);
      return await apiRequest("POST", "/api/coupons", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      handleCloseDialog();
      toast({ title: "Coupon created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create coupon", description: error.message, variant: "destructive" });
      form.setError("root", { message: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CouponFormData }) => {
      const payload = transformCouponFormData(data);
      return await apiRequest("PATCH", `/api/coupons/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      handleCloseDialog();
      toast({ title: "Coupon updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update coupon", description: error.message, variant: "destructive" });
      form.setError("root", { message: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/coupons/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      setDeletingCoupon(null);
      toast({ title: "Coupon deleted successfully" });
    },
    onError: (error: Error) => {
      setDeletingCoupon(null);
      toast({ title: "Failed to delete coupon", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenDialog = (coupon?: Coupon) => {
    if (coupon) {
      setEditingCoupon(coupon);
      form.reset({
        code: coupon.code,
        description: coupon.description || "",
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minSeats: coupon.minSeats,
        maxSeats: coupon.maxSeats,
        allowedPlans: coupon.allowedPlans,
        allowedPlansInput: (coupon.allowedPlans || []).join("\n"),
        maxRedemptions: coupon.maxRedemptions,
        validFrom: coupon.validFrom.split('T')[0],
        validUntil: coupon.validUntil ? coupon.validUntil.split('T')[0] : null,
        isActive: coupon.isActive,
      });
    } else {
      setEditingCoupon(null);
      form.reset(defaultCouponFormValues);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCoupon(null);
    form.reset(defaultCouponFormValues);
  };

  const onSubmit = (data: CouponFormData) => {
    if (editingCoupon) {
      updateMutation.mutate({ id: editingCoupon.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredCoupons = coupons?.filter(coupon =>
    coupon.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (coupon.description && coupon.description.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  const stats = {
    totalCoupons: coupons?.length || 0,
    activeCoupons: coupons?.filter(c => c.isActive).length || 0,
    totalRedemptions: coupons?.reduce((sum, c) => sum + c.currentRedemptions, 0) || 0,
  };

  return (
    <>
      <GradientHero
        icon={Tag}
        title="Coupon Codes"
        description="Manage discount coupons and promotional codes"
      />

      <div className="container mx-auto p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card data-testid="card-total-coupons">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Coupons</CardTitle>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-coupons">{stats.totalCoupons}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-active-coupons">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Coupons</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-active-coupons">{stats.activeCoupons}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-total-redemptions">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Redemptions</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-redemptions">{stats.totalRedemptions}</div>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-coupons-list">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <CardTitle>Discount Coupons</CardTitle>
                <CardDescription>Create and manage promotional discount codes</CardDescription>
              </div>
              <Button onClick={() => handleOpenDialog()} data-testid="button-create-coupon">
                <Plus className="h-4 w-4 mr-2" />
                Create Coupon
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search coupons..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-coupons"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading coupons...</div>
            ) : filteredCoupons.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No coupons found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Redemptions</TableHead>
                    <TableHead>Valid Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCoupons.map((coupon) => (
                    <TableRow key={coupon.id} data-testid={`row-coupon-${coupon.id}`}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-mono font-medium" data-testid={`text-coupon-code-${coupon.id}`}>
                            {coupon.code}
                          </div>
                          {coupon.description && (
                            <div className="text-sm text-muted-foreground">{coupon.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" data-testid={`badge-discount-${coupon.id}`}>
                          {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `$${coupon.discountValue}`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {coupon.currentRedemptions}
                          {coupon.maxRedemptions && ` / ${coupon.maxRedemptions}`}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <div>From: {format(new Date(coupon.validFrom), 'MMM d, yyyy')}</div>
                          {coupon.validUntil && (
                            <div>Until: {format(new Date(coupon.validUntil), 'MMM d, yyyy')}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={coupon.isActive ? "default" : "secondary"}
                          data-testid={`badge-status-${coupon.id}`}
                        >
                          {coupon.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-actions-${coupon.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDialog(coupon)} data-testid={`menu-edit-${coupon.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeletingCoupon(coupon)}
                              className="text-destructive"
                              data-testid={`menu-delete-${coupon.id}`}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-coupon-form">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">{editingCoupon ? "Edit Coupon" : "Create Coupon"}</DialogTitle>
            <DialogDescription>
              Configure discount code settings and restrictions
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coupon Code *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="SUMMER2024"
                        className="font-mono"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        data-testid="input-coupon-code"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Summer promotion for new customers..."
                        rows={2}
                        {...field}
                        value={field.value || ""}
                        data-testid="input-coupon-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="discountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-discount-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="discountValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {form.watch('discountType') === 'percentage' ? 'Percentage (%)' : 'Amount ($)'} *
                      </FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} data-testid="input-discount-value" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="minSeats"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Seats</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="No minimum"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          data-testid="input-min-seats"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxSeats"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Seats</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="No maximum"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          data-testid="input-max-seats"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="allowedPlansInput"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allowed Plans (one per line)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="professional&#10;enterprise"
                        rows={3}
                        {...field}
                        value={field.value || ""}
                        data-testid="input-allowed-plans"
                      />
                    </FormControl>
                    <p className="text-sm text-muted-foreground">Leave empty to allow all plans</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxRedemptions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Redemptions</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Unlimited"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                        data-testid="input-max-redemptions"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="validFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid From *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-valid-from" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="validUntil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid Until</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                          data-testid="input-valid-until"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                  {editingCoupon ? "Update Coupon" : "Create Coupon"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingCoupon} onOpenChange={(open) => !open && setDeletingCoupon(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-delete-title">Delete Coupon</AlertDialogTitle>
            <AlertDialogDescription data-testid="text-delete-description">
              Are you sure you want to delete the coupon "{deletingCoupon?.code}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCoupon && deleteMutation.mutate(deletingCoupon.id)}
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

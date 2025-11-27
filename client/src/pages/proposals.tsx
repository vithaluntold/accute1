import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addDays } from "date-fns";
import { FileText, Plus, Send, Edit, Trash2, Loader2, Calendar as CalendarIcon, X } from "lucide-react";
import { GradientHero } from "@/components/gradient-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertProposalSchema, proposalLineItemSchema, type Proposal, type Client } from "@shared/schema";
import { cn } from "@/lib/utils";

const proposalFormSchema = insertProposalSchema.extend({
  clientId: z.string().min(1, "Client is required"),
  title: z.string().min(1, "Title is required"),
  validUntil: z.date(),
  lineItems: z.array(proposalLineItemSchema).min(1, "At least one line item is required"),
});

type ProposalFormValues = z.infer<typeof proposalFormSchema>;

export default function ProposalsPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendingProposal, setSendingProposal] = useState<Proposal | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProposal, setDeletingProposal] = useState<Proposal | null>(null);

  // Get current user for organization context (with fallback for legacy organizationId)
  const { data: user } = useQuery<any>({
    queryKey: ["/api/users/me"],
  });
  const orgId = user?.defaultOrganizationId || user?.organizationId;

  // Fetch current user permissions
  const { data: currentUser } = useQuery({ queryKey: ["/api/auth/me"] });

  // Fetch proposals
  const { data: proposals = [], isLoading } = useQuery<Proposal[]>({
    queryKey: ["/api/proposals", orgId],
    enabled: !!orgId,
  });

  // Fetch clients for dropdown
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients", orgId],
    enabled: !!orgId,
  });

  // Helper function to check permissions
  const hasPermission = (permission: string): boolean => {
    if (!currentUser?.permissions) return false;
    return currentUser.permissions.some((p: any) => p.resource === permission.split('.')[0] && p.action === permission.split('.')[1]);
  };

  // Check permissions based on user role
  const permissions = {
    create: hasPermission("proposals.create"),
    edit: hasPermission("proposals.edit"),
    send: hasPermission("proposals.send"),
    delete: hasPermission("proposals.delete"),
  };

  // Filter proposals by status
  const filteredProposals = proposals.filter((proposal) => {
    if (statusFilter === "all") return true;
    return proposal.status === statusFilter;
  });

  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues: {
      clientId: "",
      organizationId: orgId || "",
      createdBy: user?.id || "",
      title: "",
      description: "",
      validFrom: new Date(),
      validUntil: addDays(new Date(), 30),
      content: "",
      termsAndConditions: "",
      notes: "",
      currency: "USD",
      lineItems: [
        {
          name: "",
          description: "",
          quantity: 1,
          rate: 0,
          amount: 0,
          taxable: true,
        },
      ],
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: 0,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  // Calculate amounts
  const lineItems = form.watch("lineItems");
  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    const taxableAmount = lineItems
      .filter((item) => item.taxable)
      .reduce((sum, item) => sum + (item.amount || 0), 0);
    const taxAmount = taxableAmount * 0.1; // 10% tax on taxable items
    const discountAmount = form.getValues("discountAmount") || 0;
    const total = subtotal + taxAmount - discountAmount;

    form.setValue("subtotal", Number(subtotal.toFixed(2)));
    form.setValue("taxAmount", Number(taxAmount.toFixed(2)));
    form.setValue("totalAmount", Number(total.toFixed(2)));
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: ProposalFormValues) => apiRequest("POST", "/api/proposals", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", orgId] });
      toast({ title: "Success", description: "Proposal created successfully" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create proposal",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProposalFormValues> }) =>
      apiRequest("PUT", `/api/proposals/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", orgId] });
      toast({ title: "Success", description: "Proposal updated successfully" });
      setDialogOpen(false);
      setEditingProposal(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update proposal",
        variant: "destructive",
      });
    },
  });

  // Send mutation
  const sendMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/proposals/${id}/send`, "POST", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", orgId] });
      toast({ title: "Success", description: "Proposal sent successfully" });
      setSendDialogOpen(false);
      setSendingProposal(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send proposal",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/proposals/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", orgId] });
      toast({ title: "Success", description: "Proposal deleted successfully" });
      setDeleteDialogOpen(false);
      setDeletingProposal(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete proposal",
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    setEditingProposal(null);
    form.reset({
      clientId: "",
      organizationId: orgId || "",
      createdBy: user?.id || "",
      title: "",
      description: "",
      validFrom: new Date(),
      validUntil: addDays(new Date(), 30),
      content: "",
      termsAndConditions: "",
      notes: "",
      currency: "USD",
      lineItems: [
        {
          name: "",
          description: "",
          quantity: 1,
          rate: 0,
          amount: 0,
          taxable: true,
        },
      ],
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: 0,
    });
    setDialogOpen(true);
  };

  const handleEdit = (proposal: Proposal) => {
    setEditingProposal(proposal);
    form.reset({
      clientId: proposal.clientId,
      organizationId: proposal.organizationId,
      createdBy: proposal.createdBy,
      title: proposal.title,
      description: proposal.description || "",
      validFrom: proposal.validFrom ? new Date(proposal.validFrom) : new Date(),
      validUntil: new Date(proposal.validUntil),
      content: proposal.content || "",
      termsAndConditions: proposal.termsAndConditions || "",
      notes: proposal.notes || "",
      currency: proposal.currency,
      lineItems: proposal.lineItems as any[] || [],
      subtotal: Number(proposal.subtotal),
      taxAmount: Number(proposal.taxAmount),
      discountAmount: Number(proposal.discountAmount),
      totalAmount: Number(proposal.totalAmount),
    });
    setDialogOpen(true);
  };

  const handleSend = (proposal: Proposal) => {
    setSendingProposal(proposal);
    setSendDialogOpen(true);
  };

  const handleDelete = (proposal: Proposal) => {
    setDeletingProposal(proposal);
    setDeleteDialogOpen(true);
  };

  const onSubmit = (data: ProposalFormValues) => {
    if (editingProposal) {
      updateMutation.mutate({ id: editingProposal.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "draft":
        return "secondary";
      case "sent":
        return "default";
      case "viewed":
        return "outline";
      case "accepted":
        return "default"; // green in production
      case "rejected":
        return "destructive";
      case "expired":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getClientName = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    return client?.companyName || "Unknown Client";
  };

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={FileText}
        title="Proposals & Quotes"
        description="Create and manage client proposals"
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList data-testid="tabs-status-filter">
                <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
                <TabsTrigger value="draft" data-testid="tab-draft">Draft</TabsTrigger>
                <TabsTrigger value="sent" data-testid="tab-sent">Sent</TabsTrigger>
                <TabsTrigger value="accepted" data-testid="tab-accepted">Accepted</TabsTrigger>
                <TabsTrigger value="rejected" data-testid="tab-rejected">Rejected</TabsTrigger>
                <TabsTrigger value="expired" data-testid="tab-expired">Expired</TabsTrigger>
              </TabsList>
              {permissions.create && (
                <Button onClick={handleCreate} data-testid="button-create-proposal">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Proposal
                </Button>
              )}
            </div>
          </Tabs>
        </div>

        {/* Data Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filteredProposals.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No proposals found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead data-testid="column-header-proposal-number">Proposal Number</TableHead>
                    <TableHead data-testid="column-header-client">Client Name</TableHead>
                    <TableHead data-testid="column-header-title">Title</TableHead>
                    <TableHead data-testid="column-header-amount">Amount</TableHead>
                    <TableHead data-testid="column-header-status">Status</TableHead>
                    <TableHead data-testid="column-header-valid-until">Valid Until</TableHead>
                    <TableHead data-testid="column-header-actions">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProposals.map((proposal) => (
                    <TableRow key={proposal.id} data-testid={`row-proposal-${proposal.id}`}>
                      <TableCell className="font-medium" data-testid={`cell-number-${proposal.id}`}>
                        {proposal.proposalNumber || "Draft"}
                      </TableCell>
                      <TableCell data-testid={`cell-client-${proposal.id}`}>
                        {getClientName(proposal.clientId)}
                      </TableCell>
                      <TableCell data-testid={`cell-title-${proposal.id}`}>{proposal.title}</TableCell>
                      <TableCell data-testid={`cell-amount-${proposal.id}`}>
                        ${Number(proposal.totalAmount).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell data-testid={`cell-status-${proposal.id}`}>
                        <Badge variant={getStatusBadgeVariant(proposal.status)}>
                          {proposal.status}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`cell-valid-until-${proposal.id}`}>
                        {format(new Date(proposal.validUntil), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {permissions.edit && (proposal.status === "draft" || proposal.status === "sent") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(proposal)}
                              data-testid={`button-edit-${proposal.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {permissions.send && proposal.status === "draft" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSend(proposal)}
                              data-testid={`button-send-${proposal.id}`}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          {permissions.delete && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(proposal)}
                              data-testid={`button-delete-${proposal.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle data-testid="dialog-title-proposal">
                {editingProposal ? "Edit Proposal" : "Create Proposal"}
              </DialogTitle>
              <DialogDescription>
                {editingProposal
                  ? "Update proposal information and line items"
                  : "Create a new proposal for your client"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-client">
                              <SelectValue placeholder="Select a client" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.companyName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="validUntil"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valid Until *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                                data-testid="button-valid-until"
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date < new Date() || date < new Date("1900-01-01")
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Q4 2024 Tax Planning Proposal" data-testid="input-title" />
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
                          {...field}
                          value={field.value || ""}
                          placeholder="Brief summary of the proposal"
                          rows={3}
                          data-testid="textarea-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Line Items */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <FormLabel>Line Items *</FormLabel>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        append({
                          name: "",
                          description: "",
                          quantity: 1,
                          rate: 0,
                          amount: 0,
                          taxable: true,
                        })
                      }
                      data-testid="button-add-line-item"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Line Item
                    </Button>
                  </div>

                  {fields.map((field, index) => (
                    <Card key={field.id} className="p-4">
                      <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-3">
                          <FormField
                            control={form.control}
                            name={`lineItems.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="Service name"
                                    data-testid={`input-line-item-name-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="col-span-3">
                          <FormField
                            control={form.control}
                            name={`lineItems.${index}.description`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value || ""}
                                    placeholder="Optional details"
                                    data-testid={`input-line-item-description-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`lineItems.${index}.quantity`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Qty</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="1"
                                    {...field}
                                    onChange={(e) => {
                                      const qty = parseFloat(e.target.value) || 1;
                                      field.onChange(qty);
                                      const rate = form.getValues(`lineItems.${index}.rate`);
                                      form.setValue(`lineItems.${index}.amount`, qty * rate);
                                      setTimeout(calculateTotals, 0);
                                    }}
                                    data-testid={`input-line-item-quantity-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`lineItems.${index}.rate`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Rate</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    {...field}
                                    onChange={(e) => {
                                      const rate = parseFloat(e.target.value) || 0;
                                      field.onChange(rate);
                                      const qty = form.getValues(`lineItems.${index}.quantity`);
                                      form.setValue(`lineItems.${index}.amount`, qty * rate);
                                      setTimeout(calculateTotals, 0);
                                    }}
                                    data-testid={`input-line-item-rate-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="col-span-1 flex items-end">
                          <FormField
                            control={form.control}
                            name={`lineItems.${index}.taxable`}
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={(checked) => {
                                      field.onChange(checked);
                                      setTimeout(calculateTotals, 0);
                                    }}
                                    data-testid={`checkbox-line-item-taxable-${index}`}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-xs">Tax</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="col-span-1 flex items-end justify-end">
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                remove(index);
                                setTimeout(calculateTotals, 0);
                              }}
                              data-testid={`button-remove-line-item-${index}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Totals */}
                <div className="bg-muted/50 p-4 rounded-md space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span data-testid="text-subtotal">
                      ${Number(form.watch("subtotal")).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax (10%):</span>
                    <span data-testid="text-tax">
                      ${Number(form.watch("taxAmount")).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-32 h-8 ml-auto"
                      value={form.watch("discountAmount")}
                      onChange={(e) => {
                        form.setValue("discountAmount", parseFloat(e.target.value) || 0);
                        setTimeout(calculateTotals, 0);
                      }}
                      data-testid="input-discount"
                    />
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total:</span>
                    <span data-testid="text-total">
                      ${Number(form.watch("totalAmount")).toFixed(2)}
                    </span>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proposal Content</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value || ""}
                          placeholder="Detailed proposal body"
                          rows={5}
                          data-testid="textarea-content"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="termsAndConditions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Terms & Conditions</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value || ""}
                          placeholder="Terms and conditions"
                          rows={3}
                          data-testid="textarea-terms"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value || ""}
                          placeholder="Internal notes (not visible to client)"
                          rows={3}
                          data-testid="textarea-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-draft"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save as Draft
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Send Proposal Dialog */}
        <AlertDialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle data-testid="dialog-title-send">
                Send Proposal
              </AlertDialogTitle>
              <AlertDialogDescription>
                Send this proposal to{" "}
                {sendingProposal && getClientName(sendingProposal.clientId)}?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-send-cancel">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => sendingProposal && sendMutation.mutate(sendingProposal.id)}
                disabled={sendMutation.isPending}
                data-testid="button-send-confirm"
              >
                {sendMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Send Proposal
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle data-testid="dialog-title-delete">
                Delete Proposal
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this proposal? This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-delete-cancel">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingProposal && deleteMutation.mutate(deletingProposal.id)}
                disabled={deleteMutation.isPending}
                data-testid="button-delete-confirm"
              >
                {deleteMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

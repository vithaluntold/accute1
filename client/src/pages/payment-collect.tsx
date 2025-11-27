import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { GradientHero } from "@/components/gradient-hero";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign,
  Plus,
  Send,
  Copy,
  Check,
  Calendar,
  FileText,
  CreditCard,
  Users,
  Trash2,
  Eye,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// Form schema for invoice creation
const invoiceFormSchema = z.object({
  clientId: z.string().min(1, "Please select a client"),
  description: z.string().min(1, "Description is required"),
  dueDate: z.string().min(1, "Due date is required"),
  items: z.array(z.object({
    description: z.string().min(1, "Item description required"),
    quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
    rate: z.coerce.number().min(0, "Rate must be positive"),
  })).min(1, "At least one item is required"),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  terms: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

export default function PaymentCollect() {
  const { toast } = useToast();
  const [paymentLinkDialog, setPaymentLinkDialog] = useState<{
    open: boolean;
    invoiceId?: string;
    link?: string;
  }>({ open: false });
  const [copied, setCopied] = useState(false);

  // Fetch clients for selection
  const { data: clients, isLoading: clientsLoading } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch invoices
  const { data: invoices, isLoading: invoicesLoading } = useQuery<any[]>({
    queryKey: ["/api/invoices"],
  });

  // Form setup
  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      clientId: "",
      description: "",
      dueDate: "",
      items: [{ description: "", quantity: 1, rate: 0 }],
      taxRate: 0,
      notes: "",
      terms: "Payment is due within 30 days of invoice date.",
    },
  });

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async (data: InvoiceFormValues) => {
      // Calculate totals
      const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
      const taxAmount = (subtotal * data.taxRate) / 100;
      const total = subtotal + taxAmount;

      const invoiceData = {
        clientId: data.clientId,
        invoiceNumber: `INV-${Date.now()}`, // Generate invoice number
        status: "sent",
        issueDate: new Date().toISOString(),
        dueDate: new Date(data.dueDate).toISOString(),
        subtotal: subtotal.toFixed(2),
        taxRate: data.taxRate.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        total: total.toFixed(2),
        amountPaid: "0.00",
        notes: data.notes,
        terms: data.terms,
        items: data.items,
      };

      const response = await apiRequest("POST", "/api/invoices", invoiceData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Invoice Created",
        description: "Payment request has been created successfully.",
      });

      // Generate payment link
      const paymentLink = `${window.location.origin}/pay/${data.id}`;
      setPaymentLinkDialog({
        open: true,
        invoiceId: data.id,
        link: paymentLink,
      });

      form.reset();
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create invoice. Please try again.",
      });
    },
  });

  // Send invoice email mutation
  const sendInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      return await apiRequest("POST", `/api/invoices/${invoiceId}/send`);
    },
    onSuccess: () => {
      toast({
        title: "Invoice Sent",
        description: "Payment request has been sent to the client's email.",
      });
    },
  });

  const onSubmit = (data: InvoiceFormValues) => {
    createInvoiceMutation.mutate(data);
  };

  const copyToClipboard = () => {
    if (paymentLinkDialog.link) {
      navigator.clipboard.writeText(paymentLinkDialog.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "Payment link copied to clipboard",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "sent": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "overdue": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "draft": return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      default: return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <GradientHero
        title="Collect Payments"
        description="Create payment requests and collect payments from your clients"
        icon={DollarSign}
      />

      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Create Payment Request Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Create Payment Request
                </CardTitle>
                <CardDescription>
                  Generate an invoice and payment link for your client
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    {/* Client Selection */}
                    <FormField
                      control={form.control}
                      name="clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-client">
                                <SelectValue placeholder="Select a client" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {clients?.map((client) => (
                                <SelectItem key={client.id} value={client.id}>
                                  {client.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Description */}
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Tax preparation services for 2024"
                              data-testid="input-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Due Date */}
                    <FormField
                      control={form.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Date</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="date"
                              data-testid="input-due-date"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Invoice Items */}
                    <div className="space-y-2">
                      <FormLabel>Invoice Items</FormLabel>
                      <ScrollArea className="max-h-[300px]">
                        <div className="space-y-3 pr-4">
                          {form.watch("items").map((item, index) => (
                            <div key={index} className="p-4 border rounded-lg space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Item {index + 1}</span>
                                {form.watch("items").length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      const items = form.getValues("items");
                                      form.setValue("items", items.filter((_, i) => i !== index));
                                    }}
                                    data-testid={`button-remove-item-${index}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              
                              <FormField
                                control={form.control}
                                name={`items.${index}.description`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        placeholder="Service description"
                                        data-testid={`input-item-description-${index}`}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <div className="grid grid-cols-2 gap-3">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.quantity`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          type="number"
                                          min="1"
                                          placeholder="Qty"
                                          data-testid={`input-item-quantity-${index}`}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name={`items.${index}.rate`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          placeholder="Rate"
                                          data-testid={`input-item-rate-${index}`}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="text-sm text-muted-foreground">
                                Amount: ${((item.quantity || 0) * (item.rate || 0)).toFixed(2)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          const items = form.getValues("items");
                          form.setValue("items", [...items, { description: "", quantity: 1, rate: 0 }]);
                        }}
                        data-testid="button-add-item"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                      </Button>
                    </div>

                    {/* Tax Rate */}
                    <FormField
                      control={form.control}
                      name="taxRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tax Rate (%)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              placeholder="0"
                              data-testid="input-tax-rate"
                            />
                          </FormControl>
                          <FormDescription>Optional sales tax or VAT rate</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Invoice Summary */}
                    <div className="p-4 bg-muted rounded-lg space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>
                          ${form.watch("items").reduce((sum, item) => sum + ((item.quantity || 0) * (item.rate || 0)), 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tax ({form.watch("taxRate")}%):</span>
                        <span>
                          ${(form.watch("items").reduce((sum, item) => sum + ((item.quantity || 0) * (item.rate || 0)), 0) * (form.watch("taxRate") / 100)).toFixed(2)}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-semibold">
                        <span>Total:</span>
                        <span>
                          ${(form.watch("items").reduce((sum, item) => sum + ((item.quantity || 0) * (item.rate || 0)), 0) * (1 + form.watch("taxRate") / 100)).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Notes */}
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Additional notes for the client"
                              rows={3}
                              data-testid="input-notes"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Terms */}
                    <FormField
                      control={form.control}
                      name="terms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Terms (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Payment terms and conditions"
                              rows={2}
                              data-testid="input-terms"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createInvoiceMutation.isPending}
                      data-testid="button-create-invoice"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {createInvoiceMutation.isPending ? "Creating..." : "Create Payment Request"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Recent Payment Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Recent Payment Requests
                </CardTitle>
                <CardDescription>
                  View and manage your recent invoices
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-3">
                    {invoicesLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Loading invoices...
                      </div>
                    ) : invoices && invoices.length > 0 ? (
                      invoices
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((invoice) => (
                          <div
                            key={invoice.id}
                            className="p-4 border rounded-lg space-y-2 hover-elevate"
                          >
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="font-medium">{invoice.invoiceNumber}</div>
                                <div className="text-sm text-muted-foreground">
                                  {clients?.find(c => c.id === invoice.clientId)?.name || "Unknown Client"}
                                </div>
                              </div>
                              <Badge className={getStatusColor(invoice.status)}>
                                {invoice.status}
                              </Badge>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Amount:</span>
                              <span className="font-semibold">${invoice.total}</span>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Due:</span>
                              <span>{new Date(invoice.dueDate).toLocaleDateString()}</span>
                            </div>

                            <div className="flex gap-2 pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                  const link = `${window.location.origin}/pay/${invoice.id}`;
                                  setPaymentLinkDialog({ open: true, invoiceId: invoice.id, link });
                                }}
                                data-testid={`button-view-link-${invoice.id}`}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View Link
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => sendInvoiceMutation.mutate(invoice.id)}
                                disabled={sendInvoiceMutation.isPending}
                                data-testid={`button-send-email-${invoice.id}`}
                              >
                                <Send className="h-4 w-4 mr-1" />
                                Send Email
                              </Button>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No invoices yet. Create your first payment request above.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Payment Link Dialog */}
      <Dialog open={paymentLinkDialog.open} onOpenChange={(open) => setPaymentLinkDialog({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment Link Generated</DialogTitle>
            <DialogDescription>
              Share this link with your client to collect payment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg break-all">
              <code className="text-sm">{paymentLinkDialog.link}</code>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={copyToClipboard}
                data-testid="button-copy-link"
              >
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copied!" : "Copy Link"}
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  if (paymentLinkDialog.invoiceId) {
                    sendInvoiceMutation.mutate(paymentLinkDialog.invoiceId);
                    setPaymentLinkDialog({ open: false });
                  }
                }}
                data-testid="button-send-email-dialog"
              >
                <Send className="h-4 w-4 mr-2" />
                Send via Email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

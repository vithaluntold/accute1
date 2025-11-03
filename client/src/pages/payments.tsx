import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { format, differenceInDays } from "date-fns";
import { CreditCard, AlertTriangle, CheckCircle, Clock, FileText, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface SubscriptionInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: string;
  amountPaid: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  paidAt: string | null;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  paymentMethod: string | null;
  gracePeriodEndsAt: string | null;
  servicesDisabledAt: string | null;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
}

interface PaymentMethod {
  id: string;
  type: string;
  nickname: string | null;
  isDefault: boolean;
  cardLast4: string | null;
  cardBrand: string | null;
  cardExpMonth: number | null;
  cardExpYear: number | null;
  upiId: string | null;
  status: string;
  lastUsedAt: string | null;
}

export default function PaymentsPage() {
  const { toast } = useToast();
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [addingPaymentMethod, setAddingPaymentMethod] = useState(false);

  const { data: invoices, isLoading } = useQuery<SubscriptionInvoice[]>({
    queryKey: ["/api/subscription-invoices"],
  });

  const { data: paymentMethods, isLoading: loadingMethods } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/payment-methods"],
  });

  const payInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await apiRequest(`/api/subscription-invoices/${invoiceId}/pay`, {
        method: "POST",
      });
      return response;
    },
    onSuccess: (data) => {
      loadRazorpayScript(() => {
        openRazorpayCheckout(data.order, data.invoice);
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to initiate payment",
        variant: "destructive",
      });
      setPayingInvoiceId(null);
    },
  });

  const loadRazorpayScript = (callback: () => void) => {
    if (window.Razorpay) {
      callback();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = callback;
    script.onerror = () => {
      toast({
        title: "Error",
        description: "Failed to load Razorpay SDK",
        variant: "destructive",
      });
      setPayingInvoiceId(null);
    };
    document.body.appendChild(script);
  };

  const openRazorpayCheckout = (order: any, invoice: SubscriptionInvoice) => {
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID || "",
      amount: order.amount,
      currency: order.currency,
      name: "Accute",
      description: `Invoice ${invoice.invoiceNumber}`,
      order_id: order.id,
      handler: async function (response: any) {
        try {
          const result = await apiRequest(`/api/subscription-invoices/${invoice.id}/complete-payment`, {
            method: "POST",
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          toast({
            title: "Success",
            description: `Payment completed via ${result.payment_method}!`,
          });

          queryClient.invalidateQueries({ queryKey: ["/api/subscription-invoices"] });
          setPayingInvoiceId(null);
        } catch (error: any) {
          toast({
            title: "Error",
            description: "Payment verification failed",
            variant: "destructive",
          });
          setPayingInvoiceId(null);
        }
      },
      modal: {
        ondismiss: function () {
          setPayingInvoiceId(null);
        },
      },
      prefill: {
        name: "",
        email: "",
      },
      theme: {
        color: "#e5a660",
      },
      config: {
        display: {
          blocks: {
            utib: {
              name: "Pay using Razorpay",
              instruments: [
                {
                  method: "upi",
                },
                {
                  method: "card",
                },
                {
                  method: "netbanking",
                },
              ],
            },
          },
          sequence: ["block.utib"],
          preferences: {
            show_default_blocks: true,
          },
        },
      },
    };

    const razorpay = new window.Razorpay(options);
    razorpay.open();
  };

  const handlePayInvoice = (invoiceId: string) => {
    setPayingInvoiceId(invoiceId);
    payInvoiceMutation.mutate(invoiceId);
  };

  // Payment Methods Mutations
  const setupPaymentMethodMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/payment-methods/setup", {
        method: "POST",
        body: JSON.stringify({ amount: 100 }), // ₹1 verification
      });
      return response;
    },
    onSuccess: (data) => {
      loadRazorpayScript(() => {
        openPaymentMethodSetup(data.order);
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to setup payment method",
        variant: "destructive",
      });
      setAddingPaymentMethod(false);
    },
  });

  const savePaymentMethodMutation = useMutation({
    mutationFn: async (data: {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
      nickname?: string;
    }) => {
      return await apiRequest("/api/payment-methods/save", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Payment method saved successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      setAddingPaymentMethod(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save payment method",
        variant: "destructive",
      });
      setAddingPaymentMethod(false);
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (methodId: string) => {
      return await apiRequest(`/api/payment-methods/${methodId}/set-default`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Default payment method updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set default payment method",
        variant: "destructive",
      });
    },
  });

  const deletePaymentMethodMutation = useMutation({
    mutationFn: async (methodId: string) => {
      return await apiRequest(`/api/payment-methods/${methodId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Payment method deleted",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete payment method",
        variant: "destructive",
      });
    },
  });

  const openPaymentMethodSetup = (order: any) => {
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID || "",
      amount: order.amount,
      currency: order.currency,
      name: "Accute",
      description: "Add Payment Method (₹1 verification)",
      order_id: order.id,
      handler: async function (response: any) {
        savePaymentMethodMutation.mutate({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: function () {
          setAddingPaymentMethod(false);
        },
      },
      theme: {
        color: "#e5a660",
      },
      config: {
        display: {
          blocks: {
            utib: {
              name: "Save Payment Method",
              instruments: [
                {
                  method: "card",
                },
                {
                  method: "upi",
                },
              ],
            },
          },
          sequence: ["block.utib"],
          preferences: {
            show_default_blocks: true,
          },
        },
      },
    };

    const razorpay = new window.Razorpay(options);
    razorpay.open();
  };

  const handleAddPaymentMethod = () => {
    setAddingPaymentMethod(true);
    setupPaymentMethodMutation.mutate();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
        return "default";
      case "pending":
        return "secondary";
      case "failed":
      case "overdue":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
        return <CheckCircle className="h-4 w-4" />;
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "failed":
      case "overdue":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const totalAmount = invoices?.reduce((sum, inv) => sum + parseFloat(inv.total || "0"), 0) || 0;
  const paidAmount = invoices?.reduce(
    (sum, inv) => (inv.status === "paid" ? sum + parseFloat(inv.amountPaid || "0") : sum),
    0
  ) || 0;
  const pendingAmount = invoices?.reduce(
    (sum, inv) => (inv.status === "pending" ? sum + parseFloat(inv.total || "0") : sum),
    0
  ) || 0;

  const overdueInvoices = invoices?.filter((inv) => {
    if (inv.status !== "pending") return false;
    const dueDate = new Date(inv.dueDate);
    return dueDate < new Date();
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display" data-testid="text-payments-title">
          Subscription Invoices
        </h1>
      </div>

      {overdueInvoices && overdueInvoices.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You have {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? "s" : ""}.
            {overdueInvoices.some((inv) => inv.gracePeriodEndsAt) && (
              <> Services will be suspended if payment is not received within the grace period.</>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Invoiced</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold" data-testid="text-total-invoiced">
              ${totalAmount.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400" data-testid="text-paid-amount">
              ${paidAmount.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600 dark:text-orange-400" data-testid="text-pending-amount">
              ${pendingAmount.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>Your subscription billing history</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p data-testid="text-loading">Loading invoices...</p>
          ) : !invoices || invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2" data-testid="text-no-invoices">
                No invoices yet
              </p>
              <p className="text-sm text-muted-foreground">
                Invoices will appear here when your subscription is active
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Billing Period</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => {
                    const daysUntilDue = differenceInDays(new Date(invoice.dueDate), new Date());
                    const isOverdue = daysUntilDue < 0 && invoice.status === "pending";
                    const gracePeriodRemaining = invoice.gracePeriodEndsAt
                      ? differenceInDays(new Date(invoice.gracePeriodEndsAt), new Date())
                      : null;

                    return (
                      <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                        <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(invoice.billingPeriodStart), "MMM d")} -{" "}
                          {format(new Date(invoice.billingPeriodEnd), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {invoice.currency === "INR" ? "₹" : "$"}
                          {parseFloat(invoice.total).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={getStatusColor(invoice.status)} className="flex items-center gap-1">
                              {getStatusIcon(invoice.status)}
                              {invoice.status}
                            </Badge>
                            {isOverdue && gracePeriodRemaining !== null && gracePeriodRemaining >= 0 && (
                              <Badge variant="destructive" className="text-xs">
                                Grace: {gracePeriodRemaining}d
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={isOverdue ? "text-destructive font-medium" : ""}>
                          {format(new Date(invoice.dueDate), "MMM d, yyyy")}
                          {isOverdue && (
                            <span className="text-xs block">
                              {Math.abs(daysUntilDue)} day{Math.abs(daysUntilDue) !== 1 ? "s" : ""} overdue
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {invoice.paymentMethod ? (
                            <Badge variant="outline" className="capitalize">
                              {invoice.paymentMethod}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {invoice.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => handlePayInvoice(invoice.id)}
                              disabled={payingInvoiceId === invoice.id}
                              data-testid={`button-pay-invoice-${invoice.id}`}
                            >
                              <CreditCard className="h-4 w-4 mr-2" />
                              {payingInvoiceId === invoice.id ? "Processing..." : "Pay Now"}
                            </Button>
                          )}
                          {invoice.status === "paid" && invoice.paidAt && (
                            <span className="text-xs text-muted-foreground">
                              Paid {format(new Date(invoice.paidAt), "MMM d")}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>
                Save a payment method for automatic invoice payments (auto-sweep)
              </CardDescription>
            </div>
            <Button
              onClick={handleAddPaymentMethod}
              disabled={addingPaymentMethod}
              data-testid="button-add-payment-method"
            >
              <Plus className="h-4 w-4 mr-2" />
              {addingPaymentMethod ? "Processing..." : "Add Payment Method"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingMethods ? (
            <div className="text-center text-muted-foreground py-8">Loading payment methods...</div>
          ) : !paymentMethods || paymentMethods.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No payment methods saved</p>
              <p className="text-sm mt-2">
                Add a payment method to enable automatic invoice payments
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                  data-testid={`payment-method-${method.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {method.nickname || `${method.type} ending in ${method.cardLast4 || method.upiId || '****'}`}
                        </p>
                        {method.isDefault && (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {method.type === 'card' && method.cardBrand && (
                          <span className="capitalize">{method.cardBrand} </span>
                        )}
                        {method.type === 'card' && method.cardExpMonth && method.cardExpYear && (
                          <span>• Expires {method.cardExpMonth}/{method.cardExpYear}</span>
                        )}
                        {method.type === 'upi' && method.upiId && (
                          <span>{method.upiId}</span>
                        )}
                        {method.lastUsedAt && (
                          <span className="ml-2">
                            • Last used {format(new Date(method.lastUsedAt), "MMM d, yyyy")}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!method.isDefault && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDefaultMutation.mutate(method.id)}
                        disabled={setDefaultMutation.isPending}
                        data-testid={`button-set-default-${method.id}`}
                      >
                        Set as Default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this payment method?")) {
                          deletePaymentMethodMutation.mutate(method.id);
                        }
                      }}
                      disabled={deletePaymentMethodMutation.isPending}
                      data-testid={`button-delete-${method.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <img src="https://razorpay.com/favicon.svg" alt="Razorpay" className="h-5 w-5" />
            Powered by Razorpay
          </CardTitle>
          <CardDescription>
            Secure payment processing supporting UPI, Cards, and Net Banking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                💳
              </div>
              <div>
                <strong>Credit/Debit Cards</strong>
                <p className="text-muted-foreground text-xs">Visa, Mastercard, Amex</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                📱
              </div>
              <div>
                <strong>UPI</strong>
                <p className="text-muted-foreground text-xs">GPay, PhonePe, Paytm</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                🏦
              </div>
              <div>
                <strong>Net Banking</strong>
                <p className="text-muted-foreground text-xs">All major banks</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                💰
              </div>
              <div>
                <strong>Wallets</strong>
                <p className="text-muted-foreground text-xs">Paytm, PhonePe, Amazon</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

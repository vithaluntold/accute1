import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  DollarSign,
  Calendar,
  FileText,
  CheckCircle2,
  CreditCard,
  Building2,
} from "lucide-react";

export default function ClientPaymentPortal() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  // Load Razorpay script dynamically
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setRazorpayLoaded(true);
    script.onerror = () => {
      console.error("Failed to load Razorpay script");
      toast({
        variant: "destructive",
        title: "Payment Gateway Error",
        description: "Failed to load payment gateway. Please refresh and try again.",
      });
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup script on component unmount
      document.body.removeChild(script);
    };
  }, [toast]);

  // Fetch invoice details
  const { data: invoice, isLoading } = useQuery<any>({
    queryKey: [`/api/invoices/${invoiceId}/public`],
    enabled: !!invoiceId,
  });

  // Process payment mutation
  const processPaymentMutation = useMutation({
    mutationFn: async () => {
      setIsProcessing(true);
      const response = await apiRequest(`/api/invoices/${invoiceId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      return response;
    },
    onSuccess: (data) => {
      // Redirect to Razorpay/Stripe payment page if payment URL is provided
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else if (data.razorpayOrderId) {
        // Initialize Razorpay checkout
        const options = {
          key: data.razorpayKeyId,
          amount: parseFloat(invoice.total) * 100, // Convert to paise
          currency: "INR",
          name: invoice.organization?.name || "Payment",
          description: `Invoice ${invoice.invoiceNumber}`,
          order_id: data.razorpayOrderId,
          handler: function (response: any) {
            // Payment successful
            toast({
              title: "Payment Successful",
              description: "Your payment has been processed successfully.",
            });
            // Verify payment
            apiRequest(`/api/invoices/${invoiceId}/verify-payment`, {
              method: "POST",
              body: JSON.stringify({
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
              }),
              headers: { "Content-Type": "application/json" },
            });
          },
          prefill: {
            email: invoice.client?.email || "",
            contact: invoice.client?.phone || "",
          },
          theme: {
            color: "#000000",
          },
        };

        // @ts-ignore
        const rzp = new window.Razorpay(options);
        rzp.open();
      }
      setIsProcessing(false);
    },
    onError: () => {
      setIsProcessing(false);
      toast({
        variant: "destructive",
        title: "Payment Failed",
        description: "Failed to initiate payment. Please try again.",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <FileText className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-semibold">Invoice Not Found</h2>
            <p className="text-muted-foreground">
              The invoice you're looking for doesn't exist or has been removed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPaid = invoice.status === "paid";
  const isOverdue = invoice.status === "overdue";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-primary mb-4">
            <Building2 className="h-8 w-8" />
            <span className="text-2xl font-bold">
              {invoice.organization?.name || "Accute"}
            </span>
          </div>
          <h1 className="text-3xl font-bold">Payment Request</h1>
          <p className="text-muted-foreground">
            {isPaid
              ? "This invoice has been paid"
              : "Please review and complete your payment below"}
          </p>
        </div>

        {/* Invoice Details Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Invoice {invoice.invoiceNumber}</CardTitle>
                <CardDescription className="mt-1">
                  Issued on {new Date(invoice.issueDate).toLocaleDateString()}
                </CardDescription>
              </div>
              <Badge
                className={
                  isPaid
                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                    : isOverdue
                    ? "bg-red-500/10 text-red-500 border-red-500/20"
                    : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                }
              >
                {invoice.status.toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Bill To */}
            <div>
              <h3 className="font-semibold mb-2">Bill To:</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="font-medium text-foreground">{invoice.client?.name}</div>
                {invoice.client?.email && <div>{invoice.client.email}</div>}
                {invoice.client?.phone && <div>{invoice.client.phone}</div>}
              </div>
            </div>

            <Separator />

            {/* Invoice Items */}
            {invoice.items && invoice.items.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Items:</h3>
                <div className="space-y-2">
                  {invoice.items.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-start justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{item.description}</div>
                        <div className="text-sm text-muted-foreground">
                          Qty: {item.quantity} × ${parseFloat(item.rate).toFixed(2)}
                        </div>
                      </div>
                      <div className="font-semibold">
                        ${(item.quantity * parseFloat(item.rate)).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Amount Summary */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>${parseFloat(invoice.subtotal).toFixed(2)}</span>
              </div>
              {parseFloat(invoice.taxRate) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tax ({parseFloat(invoice.taxRate).toFixed(2)}%):
                  </span>
                  <span>${parseFloat(invoice.taxAmount).toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total Amount:</span>
                <span className="text-primary text-2xl">
                  ${parseFloat(invoice.total).toFixed(2)}
                </span>
              </div>
              {parseFloat(invoice.amountPaid) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount Paid:</span>
                  <span className="text-green-600">
                    ${parseFloat(invoice.amountPaid).toFixed(2)}
                  </span>
                </div>
              )}
              {parseFloat(invoice.total) - parseFloat(invoice.amountPaid) > 0 && (
                <div className="flex justify-between text-base font-semibold">
                  <span>Balance Due:</span>
                  <span className="text-destructive">
                    $
                    {(
                      parseFloat(invoice.total) - parseFloat(invoice.amountPaid)
                    ).toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Due Date */}
            <div className="flex items-center gap-2 text-sm p-3 bg-muted rounded-lg">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Due Date:</span>
              <span className={isOverdue ? "text-destructive font-medium" : ""}>
                {new Date(invoice.dueDate).toLocaleDateString()}
              </span>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Notes:</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {invoice.notes}
                </p>
              </div>
            )}

            {/* Terms */}
            {invoice.terms && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Payment Terms:</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {invoice.terms}
                </p>
              </div>
            )}

            {/* Payment Button */}
            {!isPaid && (
              <Button
                size="lg"
                className="w-full text-lg h-14"
                onClick={() => processPaymentMutation.mutate()}
                disabled={isProcessing || processPaymentMutation.isPending || !razorpayLoaded}
                data-testid="button-pay-now"
              >
                {!razorpayLoaded ? (
                  <>Loading payment gateway...</>
                ) : isProcessing || processPaymentMutation.isPending ? (
                  <>Processing...</>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5 mr-2" />
                    Pay Now - ${parseFloat(invoice.total).toFixed(2)}
                  </>
                )}
              </Button>
            )}

            {isPaid && (
              <div className="flex items-center justify-center gap-2 p-4 bg-green-500/10 text-green-600 rounded-lg">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">Payment Received - Thank You!</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Powered by footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Powered by Accute - AI-Native Accounting Platform</p>
        </div>
      </div>
    </div>
  );
}

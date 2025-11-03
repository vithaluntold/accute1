import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { Plus, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PricingRegion {
  id: string;
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  priceMultiplier: string;
  isActive: boolean;
}

export default function PaymentsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("USA");

  const { data: payments, isLoading } = useQuery({
    queryKey: ["/api/payments"],
  });

  const { data: regions } = useQuery<PricingRegion[]>({
    queryKey: ["/api/pricing-regions"],
  });

  const createPaymentMutation = useMutation({
    mutationFn: async () => {
      const region = regions?.find(r => r.code === selectedRegion);
      if (!region) throw new Error("Region not found");
      if (!amount || parseFloat(amount) <= 0) throw new Error("Please enter a valid amount");

      const amountInPaise = Math.round(parseFloat(amount) * 100); // Convert to paise/cents

      // Create Razorpay order
      const order = await apiRequest("/api/razorpay/orders/create", {
        method: "POST",
        body: JSON.stringify({
          amount: amountInPaise,
          currency: region.currency,
          receipt: `receipt_${Date.now()}`,
          notes: {
            description: description || "General Payment",
            regionCode: region.code,
          },
        }),
      });

      return { order, region };
    },
    onSuccess: ({ order, region }) => {
      loadRazorpayScript(() => {
        openRazorpayCheckout(order, region);
      });
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create payment",
        variant: "destructive",
      });
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
    };
    document.body.appendChild(script);
  };

  const openRazorpayCheckout = (order: any, region: PricingRegion) => {
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID || "",
      amount: order.amount,
      currency: order.currency,
      name: "Accute",
      description: description || "Payment",
      order_id: order.id,
      handler: async function (response: any) {
        try {
          await apiRequest("/api/razorpay/verify-payment", {
            method: "POST",
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          toast({
            title: "Success",
            description: "Payment completed successfully!",
          });

          queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
          setAmount("");
          setDescription("");
        } catch (error: any) {
          toast({
            title: "Error",
            description: "Payment verification failed",
            variant: "destructive",
          });
        }
      },
      prefill: {
        name: "",
        email: "",
      },
      theme: {
        color: "#e5a660",
      },
    };

    const razorpay = new window.Razorpay(options);
    razorpay.open();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "pending": return "secondary";
      case "failed": return "destructive";
      default: return "outline";
    }
  };

  const totalPayments = payments?.reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0) || 0;
  const activeRegions = regions?.filter(r => r.isActive) || [];
  const currentRegion = regions?.find(r => r.code === selectedRegion);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display" data-testid="text-payments-title">Payments</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-payment">
              <Plus className="h-4 w-4 mr-2" />
              Create Payment
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-create-payment">
            <DialogHeader>
              <DialogTitle>Create New Payment</DialogTitle>
              <DialogDescription>
                Create a one-time payment using Razorpay
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="region">Region / Currency</Label>
                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                  <SelectTrigger id="region" data-testid="select-region">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeRegions.map((region) => (
                      <SelectItem key={region.code} value={region.code}>
                        {region.name} ({region.currencySymbol} {region.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount ({currentRegion?.currencySymbol})</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  data-testid="input-amount"
                />
                <p className="text-xs text-muted-foreground">
                  Enter amount in {currentRegion?.currency || "USD"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Payment for invoice #123..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  data-testid="input-description"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => createPaymentMutation.mutate()}
                  disabled={createPaymentMutation.isPending || !amount}
                  className="flex-1"
                  data-testid="button-proceed-payment"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  {createPaymentMutation.isPending ? "Processing..." : "Proceed to Payment"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  data-testid="button-cancel-payment"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold" data-testid="text-total-payments">${totalPayments.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold" data-testid="text-completed-payments">
              {payments?.filter((p: any) => p.status === "completed").length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold" data-testid="text-pending-payments">
              {payments?.filter((p: any) => p.status === "pending").length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>All payment transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p data-testid="text-loading">Loading payments...</p>
          ) : payments?.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4" data-testid="text-no-payments">No payments yet</p>
              <Button onClick={() => setDialogOpen(true)} data-testid="button-create-first-payment">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Payment
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments?.map((payment: any) => (
                  <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                    <TableCell>{format(new Date(payment.transactionDate), "MMM d, yyyy")}</TableCell>
                    <TableCell className="font-medium">${parseFloat(payment.amount).toFixed(2)}</TableCell>
                    <TableCell className="capitalize">{payment.method}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(payment.status)}>{payment.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {payment.notes || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <img 
              src="https://razorpay.com/favicon.svg" 
              alt="Razorpay" 
              className="h-5 w-5"
            />
            Powered by Razorpay
          </CardTitle>
          <CardDescription>Secure payment processing for 10+ international markets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <strong>🇮🇳 India</strong>
              <p className="text-muted-foreground">INR</p>
            </div>
            <div>
              <strong>🇦🇪 UAE</strong>
              <p className="text-muted-foreground">AED</p>
            </div>
            <div>
              <strong>🇹🇷 Turkey</strong>
              <p className="text-muted-foreground">TRY</p>
            </div>
            <div>
              <strong>🇺🇸 USA</strong>
              <p className="text-muted-foreground">USD</p>
            </div>
            <div>
              <strong>🇬🇧 UK</strong>
              <p className="text-muted-foreground">GBP</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Receipt, Plus, Eye } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function InvoicesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const { toast } = useToast();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["/api/invoices"],
  });

  const { data: clients } = useQuery({
    queryKey: ["/api/clients"],
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/invoices", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setDialogOpen(false);
      toast({ title: "Invoice created successfully" });
    },
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PUT", `/api/invoices/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice updated successfully" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      clientId: formData.get("clientId"),
      invoiceNumber: formData.get("invoiceNumber"),
      issueDate: new Date(formData.get("issueDate") as string),
      dueDate: new Date(formData.get("dueDate") as string),
      subtotal: parseFloat(formData.get("subtotal") as string),
      taxRate: parseFloat(formData.get("taxRate") as string) || 0,
      status: "draft",
    };

    const taxAmount = (data.subtotal * data.taxRate) / 100;
    const total = data.subtotal + taxAmount;

    createInvoiceMutation.mutate({
      ...data,
      taxAmount,
      total,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "default";
      case "sent": return "secondary";
      case "overdue": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display">Invoices</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-invoice">
              <Plus className="w-4 h-4 mr-2" />
              New Invoice
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Invoice</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Client</Label>
                <Select name="clientId" required>
                  <SelectTrigger data-testid="select-client">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((client: any) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Invoice Number</Label>
                <Input
                  name="invoiceNumber"
                  placeholder="INV-001"
                  required
                  data-testid="input-invoice-number"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Issue Date</Label>
                  <Input
                    name="issueDate"
                    type="date"
                    defaultValue={format(new Date(), "yyyy-MM-dd")}
                    required
                    data-testid="input-issue-date"
                  />
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input
                    name="dueDate"
                    type="date"
                    required
                    data-testid="input-due-date"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Subtotal ($)</Label>
                  <Input
                    name="subtotal"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    required
                    data-testid="input-subtotal"
                  />
                </div>
                <div>
                  <Label>Tax Rate (%)</Label>
                  <Input
                    name="taxRate"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    defaultValue="0"
                    data-testid="input-tax-rate"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" data-testid="button-create-invoice">
                Create Invoice
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {["draft", "sent", "paid", "overdue"].map((status) => {
          const count = invoices?.filter((inv: any) => inv.status === status).length || 0;
          return (
            <Card key={status}>
              <CardHeader>
                <CardTitle className="text-sm capitalize">{status} Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading invoices...</p>
          ) : invoices?.length === 0 ? (
            <p className="text-muted-foreground">No invoices yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices?.map((invoice: any) => {
                  const balance = parseFloat(invoice.total) - parseFloat(invoice.amountPaid);
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{format(new Date(invoice.issueDate), "MMM d, yyyy")}</TableCell>
                      <TableCell>{format(new Date(invoice.dueDate), "MMM d, yyyy")}</TableCell>
                      <TableCell>${parseFloat(invoice.total).toFixed(2)}</TableCell>
                      <TableCell>${parseFloat(invoice.amountPaid).toFixed(2)}</TableCell>
                      <TableCell>${balance.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(invoice.status)}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" data-testid={`button-view-${invoice.id}`}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

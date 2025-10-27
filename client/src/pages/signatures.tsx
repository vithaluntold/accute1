import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { FileSignature, Plus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function SignaturesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: signatureRequests, isLoading } = useQuery({
    queryKey: ["/api/signature-requests"],
  });

  const { data: clients } = useQuery({
    queryKey: ["/api/clients"],
  });

  const { data: documents } = useQuery({
    queryKey: ["/api/documents"],
  });

  const createRequestMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/signature-requests", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signature-requests"] });
      setDialogOpen(false);
      toast({ title: "Signature request created successfully" });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "signed": return "default";
      case "pending": return "secondary";
      case "declined": return "destructive";
      case "expired": return "outline";
      default: return "outline";
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display">E-Signatures</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-request">
              <Plus className="w-4 h-4 mr-2" />
              New Signature Request
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request E-Signature</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                createRequestMutation.mutate({
                  title: formData.get("title"),
                  message: formData.get("message"),
                  clientId: formData.get("clientId"),
                  documentId: formData.get("documentId") || null,
                  expiresAt: formData.get("expiresAt") ? new Date(formData.get("expiresAt") as string) : null,
                });
              }}
              className="space-y-4"
            >
              <div>
                <Label>Title</Label>
                <Input name="title" placeholder="Engagement Letter Signature" required data-testid="input-title" />
              </div>
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
                <Label>Document (Optional)</Label>
                <Select name="documentId">
                  <SelectTrigger data-testid="select-document">
                    <SelectValue placeholder="Select document" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Document</SelectItem>
                    {documents?.map((doc: any) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Message</Label>
                <Textarea name="message" placeholder="Please review and sign..." data-testid="input-message" />
              </div>
              <div>
                <Label>Expires On (Optional)</Label>
                <Input name="expiresAt" type="datetime-local" data-testid="input-expires" />
              </div>
              <Button type="submit" className="w-full" data-testid="button-create-request">
                Send Signature Request
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {["pending", "signed", "declined", "expired"].map((status) => {
          const count = signatureRequests?.filter((req: any) => req.status === status).length || 0;
          return (
            <Card key={status}>
              <CardHeader>
                <CardTitle className="text-sm capitalize">{status}</CardTitle>
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
          <CardTitle>Signature Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading signature requests...</p>
          ) : signatureRequests?.length === 0 ? (
            <p className="text-muted-foreground">No signature requests yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Signed On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signatureRequests?.map((request: any) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.title}</TableCell>
                    <TableCell>{format(new Date(request.createdAt), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(request.status)}>{request.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {request.signedAt ? format(new Date(request.signedAt), "MMM d, yyyy") : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

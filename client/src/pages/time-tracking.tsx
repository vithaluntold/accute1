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
import { Clock, Plus, Edit, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function TimeTrackingPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const { toast } = useToast();

  const { data: timeEntries, isLoading } = useQuery({
    queryKey: ["/api/time-entries"],
  });

  const { data: clients } = useQuery({
    queryKey: ["/api/clients"],
  });

  const createEntryMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/time-entries", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      setDialogOpen(false);
      toast({ title: "Time entry created successfully" });
    },
  });

  const updateEntryMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PUT", `/api/time-entries/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      setDialogOpen(false);
      setEditingEntry(null);
      toast({ title: "Time entry updated successfully" });
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/time-entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      toast({ title: "Time entry deleted successfully" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const clientId = formData.get("clientId") as string;
    const data = {
      clientId: clientId === "none" ? null : clientId || null,
      description: formData.get("description"),
      hours: parseFloat(formData.get("hours") as string),
      hourlyRate: parseFloat(formData.get("hourlyRate") as string),
      date: new Date(formData.get("date") as string),
      isBillable: formData.get("isBillable") === "true",
    };

    if (editingEntry) {
      updateEntryMutation.mutate({ id: editingEntry.id, ...data });
    } else {
      createEntryMutation.mutate(data);
    }
  };

  const totalHours = timeEntries?.reduce((sum: number, entry: any) => sum + parseFloat(entry.hours || 0), 0) || 0;
  const billableHours = timeEntries?.filter((e: any) => e.isBillable).reduce((sum: number, entry: any) => sum + parseFloat(entry.hours || 0), 0) || 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display">Time Tracking</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingEntry(null);
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-entry">
              <Plus className="w-4 h-4 mr-2" />
              New Time Entry
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingEntry ? "Edit" : "New"} Time Entry</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Client</Label>
                <Select name="clientId" defaultValue={editingEntry?.clientId || "none"}>
                  <SelectTrigger data-testid="select-client">
                    <SelectValue placeholder="Select client (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Client</SelectItem>
                    {clients?.map((client: any) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  name="description"
                  defaultValue={editingEntry?.description}
                  placeholder="What did you work on?"
                  required
                  data-testid="input-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Hours</Label>
                  <Input
                    name="hours"
                    type="number"
                    step="0.25"
                    defaultValue={editingEntry?.hours || ""}
                    placeholder="0.00"
                    required
                    data-testid="input-hours"
                  />
                </div>
                <div>
                  <Label>Hourly Rate ($)</Label>
                  <Input
                    name="hourlyRate"
                    type="number"
                    step="0.01"
                    defaultValue={editingEntry?.hourlyRate || ""}
                    placeholder="0.00"
                    data-testid="input-rate"
                  />
                </div>
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  name="date"
                  type="date"
                  defaultValue={
                    editingEntry?.date
                      ? format(new Date(editingEntry.date), "yyyy-MM-dd")
                      : format(new Date(), "yyyy-MM-dd")
                  }
                  required
                  data-testid="input-date"
                />
              </div>
              <div>
                <Label>Billable</Label>
                <Select name="isBillable" defaultValue={editingEntry?.isBillable !== false ? "true" : "false"}>
                  <SelectTrigger data-testid="select-billable">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Billable</SelectItem>
                    <SelectItem value="false">Non-Billable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" data-testid="button-save-entry">
                {editingEntry ? "Update" : "Create"} Entry
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalHours.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Billable Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{billableHours.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Non-Billable Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{(totalHours - billableHours).toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading time entries...</p>
          ) : timeEntries?.length === 0 ? (
            <p className="text-muted-foreground">No time entries yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Billable</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeEntries?.map((entry: any) => {
                  const amount = entry.hourlyRate ? parseFloat(entry.hours) * parseFloat(entry.hourlyRate) : 0;
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>{format(new Date(entry.date), "MMM d, yyyy")}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell>{parseFloat(entry.hours).toFixed(2)}</TableCell>
                      <TableCell>${entry.hourlyRate ? parseFloat(entry.hourlyRate).toFixed(2) : "-"}</TableCell>
                      <TableCell>${amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={entry.isBillable ? "default" : "secondary"}>
                          {entry.isBillable ? "Billable" : "Non-Billable"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingEntry(entry);
                              setDialogOpen(true);
                            }}
                            data-testid={`button-edit-${entry.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm("Delete this time entry?")) {
                                deleteEntryMutation.mutate(entry.id);
                              }
                            }}
                            data-testid={`button-delete-${entry.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
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

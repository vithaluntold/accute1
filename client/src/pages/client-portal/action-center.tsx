import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GradientHero } from "@/components/gradient-hero";
import { 
  ListTodo, 
  FileText, 
  CheckSquare, 
  FileSignature, 
  Clock,
  AlertCircle,
  ArrowRight,
  User,
  Building2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";

interface ActionItem {
  id: string;
  type: "task" | "document" | "signature" | "form" | "payment";
  title: string;
  description: string;
  dueDate?: string;
  priority: "low" | "medium" | "high" | "urgent";
  actionUrl: string;
  assignedBy?: string;
  isOverdue: boolean;
  responsibility: "client" | "firm";
}

interface ActionCenterData {
  summary: {
    totalPending: number;
    waitingOnMe: number;
    waitingOnFirm: number;
    overdueCount: number;
  };
  items: ActionItem[];
}

const typeIcons: Record<string, typeof FileText> = {
  task: CheckSquare,
  document: FileText,
  signature: FileSignature,
  form: FileText,
  payment: FileText,
};

const priorityColors: Record<string, string> = {
  urgent: "destructive",
  high: "default",
  medium: "secondary",
  low: "outline",
};

export default function ActionCenter() {
  const [filter, setFilter] = useState<"all" | "waiting_on_me" | "waiting_on_firm">("all");
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery<ActionCenterData>({
    queryKey: ["/api/client-portal/action-center", filter],
    queryFn: () => fetch(`/api/client-portal/action-center?filter=${filter}`).then(res => res.json()),
  });

  const handleItemClick = (item: ActionItem) => {
    setLocation(item.actionUrl);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading action center...</div>
      </div>
    );
  }

  const { summary, items } = data || { summary: { totalPending: 0, waitingOnMe: 0, waitingOnFirm: 0, overdueCount: 0 }, items: [] };

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={ListTodo}
        title="Action Center"
        description="All your pending items in one place"
        testId="action-center"
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card data-testid="card-total-pending">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
              <ListTodo className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-pending">
                {summary.totalPending}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-waiting-on-me">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Waiting on Me</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-waiting-on-me">
                {summary.waitingOnMe}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-waiting-on-firm">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Waiting on Firm</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-waiting-on-firm">
                {summary.waitingOnFirm}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-overdue">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" data-testid="text-overdue">
                {summary.overdueCount}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList data-testid="tabs-action-filter">
            <TabsTrigger value="all" data-testid="tab-all">
              All ({summary.totalPending})
            </TabsTrigger>
            <TabsTrigger value="waiting_on_me" data-testid="tab-waiting-on-me">
              Waiting on Me ({summary.waitingOnMe})
            </TabsTrigger>
            <TabsTrigger value="waiting_on_firm" data-testid="tab-waiting-on-firm">
              Waiting on Firm ({summary.waitingOnFirm})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-6">
            {items.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <ListTodo className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    No pending items in this category
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const Icon = typeIcons[item.type] || FileText;
                  const priorityColor = priorityColors[item.priority] || "secondary";

                  return (
                    <Card
                      key={item.id}
                      className="hover-elevate cursor-pointer"
                      onClick={() => handleItemClick(item)}
                      data-testid={`action-item-${item.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="mt-1">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-medium">{item.title}</h3>
                              <div className="flex items-center gap-2">
                                {item.isOverdue && (
                                  <Badge variant="destructive" className="text-xs">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Overdue
                                  </Badge>
                                )}
                                <Badge variant={priorityColor as any} className="text-xs">
                                  {item.priority}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {item.dueDate && (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Due {formatDistanceToNow(new Date(item.dueDate), { addSuffix: true })}
                                </div>
                              )}
                              {item.assignedBy && (
                                <div>Assigned by {item.assignedBy}</div>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {item.responsibility === "client" ? "Your action required" : "Waiting on firm"}
                              </Badge>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="mt-1">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

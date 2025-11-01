import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Building2, Users, Calendar, MoreVertical, Ban, Play, X, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { GradientHero } from "@/components/gradient-hero";

export default function OrganizationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: orgs, isLoading } = useQuery<Array<{
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    userCount?: number;
    clientCount?: number;
    subscription?: {
      id: string;
      plan: string;
      status: string;
      currentUsers: number;
      currentClients: number;
      maxUsers: number;
      maxClients: number;
    };
  }>>({
    queryKey: ["/api/admin/organizations"],
  });

  // Update subscription status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest("PATCH", `/api/admin/subscriptions/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      toast({ title: "Subscription status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update subscription", description: error.message, variant: "destructive" });
    },
  });

  const filteredOrgs = orgs?.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.slug.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case "free": return "secondary";
      case "starter": return "default";
      case "professional": return "default";
      case "enterprise": return "default";
      default: return "secondary";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "suspended": return "destructive";
      case "cancelled": return "secondary";
      case "expired": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={Building2}
        title="Organizations"
        description="Manage all organizations and their subscriptions"
        testId="hero-organizations"
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Organizations</CardTitle>
                <CardDescription>View and manage organization subscriptions</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  data-testid="input-search-organizations"
                  placeholder="Search organizations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="loading-organizations">Loading organizations...</div>
            ) : filteredOrgs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="empty-organizations">
                No organizations found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrgs.map((org) => (
                    <TableRow key={org.id} data-testid={`row-organization-${org.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium" data-testid={`text-org-name-${org.id}`}>{org.name}</div>
                            <div className="text-sm text-muted-foreground">@{org.slug}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getPlanBadgeVariant(org.subscription?.plan || "free")} data-testid={`badge-plan-${org.id}`}>
                          {org.subscription?.plan?.toUpperCase() || "FREE"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(org.subscription?.status || "active")} data-testid={`badge-status-${org.id}`}>
                          {org.subscription?.status?.toUpperCase() || "ACTIVE"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            <span>{org.subscription?.currentUsers || 0}/{org.subscription?.maxUsers || 5} users</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span>{org.subscription?.currentClients || 0}/{org.subscription?.maxClients || 10} clients</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(org.createdAt), "MMM d, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" data-testid={`button-manage-org-${org.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => setLocation(`/admin/subscriptions`)}
                              data-testid={`action-view-subscription-${org.id}`}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Subscription
                            </DropdownMenuItem>
                            {org.subscription && org.subscription.status === "active" && (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => updateStatusMutation.mutate({ id: org.subscription!.id, status: "suspended" })}
                                  data-testid={`action-suspend-${org.id}`}
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Suspend (Non-payment)
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => updateStatusMutation.mutate({ id: org.subscription!.id, status: "cancelled" })}
                                  data-testid={`action-cancel-${org.id}`}
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Cancel Subscription
                                </DropdownMenuItem>
                              </>
                            )}
                            {org.subscription && org.subscription.status === "suspended" && (
                              <DropdownMenuItem 
                                onClick={() => updateStatusMutation.mutate({ id: org.subscription!.id, status: "active" })}
                                data-testid={`action-resume-${org.id}`}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Resume (Manual Override)
                              </DropdownMenuItem>
                            )}
                            {org.subscription && (org.subscription.status === "cancelled" || org.subscription.status === "expired") && (
                              <DropdownMenuItem 
                                onClick={() => updateStatusMutation.mutate({ id: org.subscription!.id, status: "active" })}
                                data-testid={`action-reactivate-${org.id}`}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Reactivate
                              </DropdownMenuItem>
                            )}
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
    </div>
  );
}

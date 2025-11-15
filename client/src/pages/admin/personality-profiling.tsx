import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Brain, Play, RefreshCw, Users, TrendingUp, Clock, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

type MlAnalysisRun = {
  id: string;
  organizationId: string;
  runType: string;
  status: "queued" | "in_progress" | "completed" | "failed";
  totalUsers: number;
  usersProcessed: number;
  failedUsers: number;
  conversationsAnalyzed: number;
  modelsUsed: string[];
  tokensConsumed: number;
  processingTimeSeconds: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type MlAnalysisJob = {
  id: string;
  analysisRunId: string;
  userId: string;
  status: "pending" | "claimed" | "processing" | "completed" | "failed";
  attemptCount: number;
  maxAttempts: number;
  tokensUsed: number;
  errorMessage: string | null;
  claimedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
};

type QueueStats = {
  pending: number;
  claimed: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
};

type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

type PerformanceCorrelation = {
  framework: string;
  trait: string;
  metricId: string;
  correlation: number;
  sampleSize: number;
  strength: "strong" | "moderate" | "weak";
  direction: "positive" | "negative";
};

export default function AdminPersonalityProfiling() {
  const { toast } = useToast();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);

  // Fetch all users for batch selection
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch queue statistics
  const { data: queueStats, isLoading: loadingStats } = useQuery<QueueStats>({
    queryKey: ["/api/personality-profiling/queue/stats"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch performance correlations
  const { data: correlations, error: correlationsError } = useQuery<{
    organizationId: string;
    profilesAnalyzed: number;
    correlations: PerformanceCorrelation[];
    generatedAt: string;
  }>({
    queryKey: ["/api/personality-profiling/performance-correlations"],
    retry: 1, // Don't retry if access is denied
  });

  // Fetch recent analysis runs
  const { data: recentRuns = [], isLoading: loadingRuns } = useQuery<MlAnalysisRun[]>({
    queryKey: ["/api/personality-profiling/runs"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch jobs for selected run
  const { data: runJobs = [] } = useQuery<MlAnalysisJob[]>({
    queryKey: ["/api/personality-profiling/runs", selectedRunId, "jobs"],
    enabled: !!selectedRunId,
    refetchInterval: selectedRunId ? 5000 : false,
  });

  // Fetch selected run details
  const { data: selectedRun } = useQuery<MlAnalysisRun>({
    queryKey: ["/api/personality-profiling/runs", selectedRunId],
    enabled: !!selectedRunId,
    refetchInterval: selectedRunId ? 5000 : false,
  });

  // Trigger batch analysis mutation
  const triggerBatchMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      const response = await apiRequest<{ runId: string; message: string }>(
        "/api/personality-profiling/batch-analysis",
        {
          method: "POST",
          body: JSON.stringify({ userIds }),
        }
      );
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Batch Analysis Triggered",
        description: `Analysis run started with ID: ${data.runId}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/personality-profiling/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/personality-profiling/queue/stats"] });
      setIsBatchDialogOpen(false);
      setSelectedUsers([]);
      setSelectedRunId(data.runId);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to trigger batch analysis",
        variant: "destructive",
      });
    },
  });

  const handleTriggerBatch = () => {
    if (selectedUsers.length === 0) {
      toast({
        title: "No Users Selected",
        description: "Please select at least one user for analysis",
        variant: "destructive",
      });
      return;
    }
    triggerBatchMutation.mutate(selectedUsers);
  };

  const handleSelectAllUsers = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(u => u.id));
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any }> = {
      queued: { variant: "outline" as const, icon: Clock },
      in_progress: { variant: "default" as const, icon: Loader2 },
      processing: { variant: "default" as const, icon: Loader2 },
      completed: { variant: "default" as const, icon: CheckCircle2 },
      failed: { variant: "destructive" as const, icon: XCircle },
      claimed: { variant: "outline" as const, icon: AlertCircle },
      pending: { variant: "outline" as const, icon: Clock },
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getUserDisplay = (user?: { email: string; firstName: string | null; lastName: string | null }) => {
    if (!user) return "Unknown User";
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
    return name || user.email;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Brain className="w-8 h-8" />
            AI Personality Profiling
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Manage and monitor personality analysis across your organization
          </p>
        </div>

        <Dialog open={isBatchDialogOpen} onOpenChange={setIsBatchDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" data-testid="button-trigger-batch">
              <Play className="w-4 h-4" />
              Trigger Batch Analysis
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle data-testid="text-dialog-title">Select Users for Analysis</DialogTitle>
              <DialogDescription>
                Choose users to analyze their personality traits based on conversation history
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md sticky top-0">
                <Checkbox
                  id="select-all"
                  checked={selectedUsers.length === users.length && users.length > 0}
                  onCheckedChange={handleSelectAllUsers}
                  data-testid="checkbox-select-all"
                />
                <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                  Select All Users ({users.length})
                </label>
              </div>

              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-2 p-3 hover-elevate rounded-md">
                  <Checkbox
                    id={`user-${user.id}`}
                    checked={selectedUsers.includes(user.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedUsers([...selectedUsers, user.id]);
                      } else {
                        setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                      }
                    }}
                    data-testid={`checkbox-user-${user.id}`}
                  />
                  <label
                    htmlFor={`user-${user.id}`}
                    className="flex-1 text-sm cursor-pointer"
                  >
                    <div className="font-medium">{getUserDisplay(user)}</div>
                    <div className="text-muted-foreground text-xs">{user.email}</div>
                  </label>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsBatchDialogOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleTriggerBatch}
                disabled={selectedUsers.length === 0 || triggerBatchMutation.isPending}
                data-testid="button-start-analysis"
              >
                {triggerBatchMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Start Analysis ({selectedUsers.length})
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Queue Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Jobs</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-pending">
              {loadingStats ? "..." : queueStats?.pending || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-processing">
              {loadingStats ? "..." : (queueStats?.processing || 0) + (queueStats?.claimed || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-completed">
              {loadingStats ? "..." : queueStats?.completed || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="text-stat-failed">
              {loadingStats ? "..." : queueStats?.failed || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Correlations Insight */}
      {correlationsError && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Failed to load performance correlations. Please ensure you have proper organization access.
          </AlertDescription>
        </Alert>
      )}
      {correlations && correlations.correlations && correlations.correlations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Performance Insights
            </CardTitle>
            <CardDescription>
              Statistical correlations between personality traits and performance metrics ({correlations.profilesAnalyzed} users analyzed)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {correlations.correlations.slice(0, 5).map((corr, idx) => (
                <div key={idx} className="p-3 rounded-md bg-muted/50 hover-elevate" data-testid={`insight-${idx}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium capitalize">
                      {corr.trait.replace('_', ' ')}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={corr.strength === "strong" ? "default" : "outline"}>
                        {corr.strength}
                      </Badge>
                      <Badge variant={corr.direction === "positive" ? "default" : "destructive"}>
                        {corr.direction === "positive" ? "+" : "-"}{Math.abs(corr.correlation).toFixed(2)}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {corr.direction === "positive" ? "Higher" : "Lower"} {corr.trait} correlates with {corr.direction === "positive" ? "better" : "lower"} performance
                    ({corr.sampleSize} users)
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for Runs and Jobs */}
      <Tabs defaultValue="runs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="runs" data-testid="tab-runs">Analysis Runs</TabsTrigger>
          <TabsTrigger value="jobs" disabled={!selectedRunId} data-testid="tab-jobs">
            Job Details {selectedRunId && `(${runJobs.length})`}
          </TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">
            Team Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Recent Analysis Runs</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/personality-profiling/runs"] });
                  }}
                  data-testid="button-refresh-runs"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </CardTitle>
              <CardDescription>
                View and monitor personality analysis batch jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRuns ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : recentRuns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-runs">
                  No analysis runs yet. Trigger a batch analysis to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Conversations</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentRuns.map((run) => {
                      const progress = run.totalUsers > 0 ? (run.usersProcessed / run.totalUsers) * 100 : 0;
                      return (
                        <TableRow
                          key={run.id}
                          className={selectedRunId === run.id ? "bg-muted/50" : ""}
                          data-testid={`row-run-${run.id}`}
                        >
                          <TableCell className="font-mono text-xs" data-testid={`text-run-id-${run.id}`}>
                            {run.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell data-testid={`badge-status-${run.id}`}>
                            {getStatusBadge(run.status)}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 min-w-32">
                              <Progress value={progress} className="h-2" />
                              <div className="text-xs text-muted-foreground">
                                {run.usersProcessed}/{run.totalUsers} users
                                {run.failedUsers > 0 && ` (${run.failedUsers} failed)`}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-users-${run.id}`}>
                            {run.totalUsers}
                          </TableCell>
                          <TableCell data-testid={`text-conversations-${run.id}`}>
                            {run.conversationsAnalyzed}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(run.createdAt), "MMM d, HH:mm")}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedRunId(run.id)}
                              data-testid={`button-view-jobs-${run.id}`}
                            >
                              View Jobs
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
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          {selectedRun && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Run Details: {selectedRun.id.slice(0, 12)}...</span>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedRun.status)}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedRunId(null)}
                      data-testid="button-back-to-runs"
                    >
                      Back to Runs
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  Individual job status for {selectedRun.totalUsers} users
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Run Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Total Users</div>
                    <div className="text-2xl font-bold">{selectedRun.totalUsers}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Processed</div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {selectedRun.usersProcessed}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                    <div className="text-2xl font-bold text-destructive">
                      {selectedRun.failedUsers}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Conversations</div>
                    <div className="text-2xl font-bold">{selectedRun.conversationsAnalyzed}</div>
                  </div>
                </div>

                {/* Jobs Table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Tokens</TableHead>
                      <TableHead>Completed At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runJobs.map((job) => (
                      <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                        <TableCell data-testid={`text-job-user-${job.id}`}>
                          {getUserDisplay(job.user)}
                        </TableCell>
                        <TableCell data-testid={`badge-job-status-${job.id}`}>
                          {getStatusBadge(job.status)}
                        </TableCell>
                        <TableCell>
                          <span className={job.attemptCount >= job.maxAttempts ? "text-destructive" : ""}>
                            {job.attemptCount}/{job.maxAttempts}
                          </span>
                        </TableCell>
                        <TableCell data-testid={`text-job-tokens-${job.id}`}>
                          {job.tokensUsed.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {job.completedAt ? format(new Date(job.completedAt), "MMM d, HH:mm") : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Team Composition Insights
              </CardTitle>
              <CardDescription>
                AI-powered recommendations based on personality trait distribution
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {correlations && correlations.correlations.length > 0 ? (
                <>
                  <Alert>
                    <Brain className="w-4 h-4" />
                    <AlertDescription>
                      <strong>Recommendation Engine:</strong> Based on {correlations.profilesAnalyzed} analyzed profiles,
                      we've identified the following patterns and recommendations for optimal team performance.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-3">
                    <h4 className="font-semibold">Top Trait-Performance Correlations</h4>
                    {correlations.correlations.slice(0, 3).map((corr, idx) => (
                      <Card key={idx} className="bg-muted/30">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="font-medium capitalize">{corr.trait.replace('_', ' ')}</div>
                              <Badge variant="outline" className="mt-1">
                                {corr.framework}
                              </Badge>
                            </div>
                            <Badge variant={corr.strength === "strong" ? "default" : "outline"}>
                              {Math.abs(corr.correlation * 100).toFixed(0)}% correlation
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            💡 <strong>Recommendation:</strong> When assigning high-stakes tasks, prioritize team members with {corr.direction === "positive" ? "higher" : "lower"} {corr.trait}.
                            This trait shows a {corr.strength} {corr.direction} correlation with performance.
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-semibold mb-3">Team Diversity Score</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Personality trait diversity</span>
                        <span className="font-semibold">
                          {correlations.profilesAnalyzed > 10 ? "High" : correlations.profilesAnalyzed > 5 ? "Moderate" : "Low"}
                        </span>
                      </div>
                      <Progress
                        value={Math.min((correlations.profilesAnalyzed / 20) * 100, 100)}
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground">
                        {correlations.profilesAnalyzed < 10
                          ? "Analyze more team members to get better diversity insights."
                          : "Your team shows good personality diversity, which can lead to creative problem-solving."}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-insights">
                  <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No insights available yet</p>
                  <p className="text-sm mt-1">
                    Trigger a batch analysis to generate personality profiles and unlock team insights.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

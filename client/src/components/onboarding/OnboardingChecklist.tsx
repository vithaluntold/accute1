import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle2, 
  Trophy, 
  Flame, 
  Target, 
  Star,
  ChevronRight,
  Calendar,
  Rocket
} from "lucide-react";
import { format } from "date-fns";

interface OnboardingProgress {
  id: string;
  userId: string;
  organizationId: string;
  currentDay: number;
  isCompleted: boolean;
  completedAt?: string;
  totalScore: number;
  currentStreak: number;
  longestStreak: number;
  region: string;
  completedSteps: string[];
  unlockedFeatures: string[];
  badges: any;
  lastActivityAt: string;
  lastLoginAt?: string;
  loginDates: string[];
  skipWalkthroughs: boolean;
  enableNudges: boolean;
  metadata?: any;
}

interface OnboardingTask {
  id: string;
  progressId: string;
  day: number;
  taskId: string;
  taskType: string;
  title: string;
  description?: string;
  isCompleted: boolean;
  completedAt?: string;
  points: number;
  isRequired: boolean;
  actionUrl?: string;
  estimatedMinutes?: number;
  videoUrl?: string;
}

interface OnboardingNudge {
  id: string;
  progressId: string;
  nudgeId: string;
  nudgeType: string;
  title?: string;
  message: string;
  timesShown: number;
  maxShowCount?: number;
  isDismissed: boolean;
  dismissedAt?: string;
  targetElement?: string;
  actionUrl?: string;
  actionLabel?: string;
}

interface OnboardingData {
  progress: OnboardingProgress;
  tasks: OnboardingTask[];
  activeNudges: OnboardingNudge[];
}

export function OnboardingChecklist() {
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<OnboardingData>({
    queryKey: ['/api/onboarding/progress'],
    retry: false,
  });

  const startOnboardingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/onboarding/progress', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/progress'] });
      toast({
        title: "Welcome aboard!",
        description: "Your 21-day journey has begun. Let's get started!",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to start onboarding",
        description: error.message || "Please try again",
      });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await apiRequest('POST', `/api/onboarding/tasks/${taskId}/complete`, {});
    },
    onSuccess: async (result, taskId) => {
      const task = data?.tasks.find(t => t.id === taskId);
      // Fix: Refresh data after mutation to sync with server state
      await queryClient.invalidateQueries({ queryKey: ['/api/onboarding/progress'] });
      toast({
        title: "Task completed!",
        description: task ? `+${task.points} points earned` : "Progress updated",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to complete task",
        description: error.message || "Please try again",
      });
    },
  });

  if (isLoading) {
    return (
      <Card data-testid="card-onboarding-loading">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card data-testid="card-onboarding-error">
        <CardHeader>
          <CardTitle>Onboarding Not Started</CardTitle>
          <CardDescription>
            Your onboarding journey hasn't been initialized yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-[#e5a660] to-[#d76082] flex items-center justify-center mx-auto mb-4">
              <Rocket className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Ready to Begin?</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Start your 21-day journey to master Accute. Complete tasks, earn points, and unlock powerful features.
            </p>
            <Button
              size="lg"
              onClick={() => startOnboardingMutation.mutate()}
              disabled={startOnboardingMutation.isPending}
              data-testid="button-start-onboarding"
            >
              {startOnboardingMutation.isPending ? (
                "Initializing..."
              ) : (
                <>
                  <Rocket className="w-4 h-4 mr-2" />
                  Get Started
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { progress, tasks } = data;
  const currentDayTasks = tasks.filter(t => t.day === progress.currentDay);
  const completedCount = currentDayTasks.filter(t => t.isCompleted).length;
  const totalCount = currentDayTasks.length;
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  
  // Fix: Show 100% when completed, otherwise calculate inclusive of current day
  const overallProgress = progress.isCompleted 
    ? 100 
    : (progress.currentDay / 21) * 100;

  return (
    <div className="space-y-6" data-testid="container-onboarding-checklist">
      {/* Progress Overview Card */}
      <Card data-testid="card-onboarding-overview">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                21-Day Onboarding Journey
              </CardTitle>
              <CardDescription>
                Day {progress.currentDay} of 21 - {progress.isCompleted ? 'Completed!' : 'In Progress'}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary" data-testid="badge-total-score">
                <Trophy className="w-3 h-3 mr-1" />
                {progress.totalScore} pts
              </Badge>
              <Badge variant="secondary" data-testid="badge-current-streak">
                <Flame className="w-3 h-3 mr-1" />
                {progress.currentStreak} day streak
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-medium">{Math.round(overallProgress)}%</span>
            </div>
            <Progress value={overallProgress} data-testid="progress-overall" />
          </div>

          {/* Today's Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Today's Tasks ({completedCount}/{totalCount})
              </span>
              <span className="font-medium">{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} data-testid="progress-today" />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Unlocked Features</p>
              <p className="text-lg font-semibold" data-testid="text-unlocked-features">
                {progress.unlockedFeatures.length}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Longest Streak</p>
              <p className="text-lg font-semibold" data-testid="text-longest-streak">
                {progress.longestStreak} days
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Last Active</p>
              <p className="text-lg font-semibold" data-testid="text-last-active">
                {progress.lastActivityAt ? format(new Date(progress.lastActivityAt), 'MMM d') : 'Never'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today's Tasks Card */}
      <Card data-testid="card-today-tasks">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Day {progress.currentDay} Tasks
          </CardTitle>
          <CardDescription>
            Complete these tasks to earn points and unlock features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentDayTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Star className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>All caught up! Check back tomorrow for new tasks.</p>
            </div>
          ) : (
            currentDayTasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-start gap-3 p-4 rounded-md border ${
                  task.isCompleted ? 'bg-muted/50 border-muted' : 'bg-card border-border'
                }`}
                data-testid={`task-item-${task.taskId}`}
              >
                <Checkbox
                  id={task.id}
                  checked={task.isCompleted}
                  disabled={task.isCompleted || completeTaskMutation.isPending}
                  onCheckedChange={() => {
                    if (!task.isCompleted) {
                      completeTaskMutation.mutate(task.id);
                    }
                  }}
                  data-testid={`checkbox-task-${task.taskId}`}
                />
                <div className="flex-1 space-y-1">
                  <label
                    htmlFor={task.id}
                    className={`text-sm font-medium cursor-pointer ${
                      task.isCompleted ? 'line-through text-muted-foreground' : ''
                    }`}
                  >
                    {task.title}
                    {task.isRequired && (
                      <Badge variant="destructive" className="ml-2 text-xs">
                        Required
                      </Badge>
                    )}
                  </label>
                  {task.description && (
                    <p className="text-xs text-muted-foreground">{task.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {task.estimatedMinutes && (
                      <span>⏱️ {task.estimatedMinutes} min</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Trophy className="w-3 h-3" />
                      {task.points} pts
                    </span>
                    {task.completedAt && (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="w-3 h-3" />
                        Completed {format(new Date(task.completedAt), 'MMM d, h:mm a')}
                      </span>
                    )}
                  </div>
                </div>
                {task.actionUrl && !task.isCompleted && (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    data-testid={`button-task-action-${task.taskId}`}
                  >
                    <a href={task.actionUrl}>
                      Go
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </a>
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Clock } from "lucide-react";
import { GradientHero } from "@/components/gradient-hero";

export default function WorkloadView() {
  const { data: workloadData } = useQuery<any>({ queryKey: ["/api/workload-insights"] });

  return (
    <div className="flex flex-col h-screen">
      <GradientHero
        title="Workload & Capacity"
        description="Monitor team capacity and resource allocation"
        icon={Users}
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-6">
          {workloadData?.users?.map((user: any) => (
            <Card key={user.userId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{user.userName || "User"}</CardTitle>
                  <Badge>{user.totalAssignments} assignments</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Capacity</span>
                      <span className="text-sm text-muted-foreground">
                        {user.totalHoursLogged || 0}h / 40h
                      </span>
                    </div>
                    <Progress value={((user.totalHoursLogged || 0) / 40) * 100} />
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Tasks</p>
                      <p className="font-medium">{user.totalTasks || 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Completed</p>
                      <p className="font-medium">{user.completedTasks || 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Completion %</p>
                      <p className="font-medium">{user.completionRate || 0}%</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

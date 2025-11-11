import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, Users, Clock } from "lucide-react";
import { GradientHero } from "@/components/gradient-hero";

export default function ResourceAllocation() {
  const { data: workloadData } = useQuery<any>({ queryKey: ["/api/workload-insights"] });

  return (
    <div className="flex flex-col h-screen">
      <GradientHero
        title="Resource Allocation & PTO"
        description="Manage team availability and time-off calendar"
        icon={Users}
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Resource Allocation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workloadData?.users?.map((user: any, idx: number) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{user.userName || "User"}</span>
                      <Badge>{user.totalAssignments || 0} assignments</Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Capacity</span>
                        <span>{user.totalHoursLogged || 0}h / 40h</span>
                      </div>
                      <Progress value={((user.totalHoursLogged || 0) / 40) * 100} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Time-Off Calendar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-12">
                <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">PTO Calendar</p>
                <p className="text-sm">Vacation and time-off tracking coming soon</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

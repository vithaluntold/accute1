import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GanttChartSquare } from "lucide-react";
import { GradientHero } from "@/components/gradient-hero";

export default function TimelineView() {
  const { data: projects } = useQuery<any[]>({ queryKey: ["/api/projects"] });
  const { data: tasks } = useQuery<any[]>({ queryKey: ["/api/tasks"] });

  return (
    <div className="flex flex-col h-screen">
      <GradientHero
        title="Timeline View"
        description="High-level project roadmap and milestone tracking"
        icon={GanttChartSquare}
      />
      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Timeline View</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-muted-foreground py-12">
              <GanttChartSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Timeline View</p>
              <p className="text-sm">High-level project roadmap visualization coming soon</p>
              <div className="mt-4">
                <Badge>{projects?.length || 0} Projects</Badge>
                <Badge className="ml-2">{tasks?.length || 0} Tasks</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

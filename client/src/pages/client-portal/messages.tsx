import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GradientHero } from "@/components/gradient-hero";
import { MessageSquare } from "lucide-react";

export default function ClientPortalMessages() {
  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={MessageSquare}
        title="Messages"
        description="Communicate with your team and get support"
        testId="client-messages"
      />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <Card data-testid="card-messages">
          <CardHeader>
            <CardTitle>Client Messages</CardTitle>
            <CardDescription>
              Communication with your accounting team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground" data-testid="text-coming-soon">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium mb-2">Messages Coming Soon</p>
              <p className="text-sm">
                Client messaging functionality will be available here soon.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

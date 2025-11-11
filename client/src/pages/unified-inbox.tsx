import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Inbox, Mail, MessageSquare, Bell } from "lucide-react";
import { GradientHero } from "@/components/gradient-hero";
import { formatDistanceToNow } from "date-fns";

export default function UnifiedInbox() {
  const { data: emailMessages } = useQuery<any[]>({ queryKey: ["/api/email-messages"] });
  const { data: chatMessages } = useQuery<any[]>({ queryKey: ["/api/team-chat/messages"] });
  const { data: portalConversations } = useQuery<any[]>({ queryKey: ["/api/client-portal/conversations"] });

  const allMessages = [
    ...(emailMessages?.map(m => ({ ...m, type: "email", icon: Mail })) || []),
    ...(chatMessages?.map(m => ({ ...m, type: "chat", icon: MessageSquare })) || []),
    ...(portalConversations?.map(m => ({ ...m, type: "portal", icon: Bell })) || []),
  ].sort((a, b) => new Date(b.createdAt || b.receivedAt).getTime() - new Date(a.createdAt || a.receivedAt).getTime());

  return (
    <div className="flex flex-col h-screen">
      <GradientHero
        title="Unified Inbox"
        description="All your communications in one place - email, chat, and portal messages"
        icon={Inbox}
      />
      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              All Messages
              <Badge variant="secondary" className="ml-auto">{allMessages.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
                <TabsTrigger value="email" data-testid="tab-email">Email</TabsTrigger>
                <TabsTrigger value="chat" data-testid="tab-chat">Chat</TabsTrigger>
                <TabsTrigger value="portal" data-testid="tab-portal">Portal</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="space-y-2">
                {allMessages.map((msg, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 border rounded-lg hover-elevate cursor-pointer" data-testid={`message-${idx}`}>
                    <msg.icon className="h-5 w-5 mt-1 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium truncate">{msg.subject || msg.content?.substring(0, 50) || "No subject"}</p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(msg.createdAt || msg.receivedAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{msg.from || msg.senderName || "Unknown"}</p>
                    </div>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="email">
                {emailMessages?.map((msg, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 border rounded-lg hover-elevate cursor-pointer mb-2" data-testid={`email-${idx}`}>
                    <Mail className="h-5 w-5 mt-1" />
                    <div className="flex-1">
                      <p className="font-medium">{msg.subject}</p>
                      <p className="text-sm text-muted-foreground">{msg.from}</p>
                    </div>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="chat">
                <p className="text-muted-foreground">Chat messages will appear here</p>
              </TabsContent>
              <TabsContent value="portal">
                <p className="text-muted-foreground">Portal messages will appear here</p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

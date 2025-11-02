import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface TeamChatProps {
  teamId: string;
  teamName: string;
}

interface ChatMessage {
  id: string;
  teamId: string;
  senderId: string;
  message: string;
  metadata: any;
  createdAt: string;
}

export default function TeamChat({ teamId, teamName }: TeamChatProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);

  // Fetch initial messages
  const { data: initialMessages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/teams", teamId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/messages?limit=50`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
  });

  // Initialize messages
  useEffect(() => {
    if (initialMessages.length > 0 && localMessages.length === 0) {
      setLocalMessages(initialMessages);
    }
  }, [initialMessages]);

  // WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/team-chat`;
    
    const websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
      console.log('[Team Chat] WebSocket connected');
      setIsConnected(true);
      
      // Join the team chat
      websocket.send(JSON.stringify({
        type: 'join_team',
        teamId,
      }));
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'team_joined':
          console.log('[Team Chat] Joined team chat');
          break;
        case 'new_message':
          setLocalMessages((prev) => [...prev, data.data]);
          // Auto-scroll to bottom
          setTimeout(() => {
            scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
          break;
        case 'user_joined':
          console.log('[Team Chat] User joined:', data.data.userId);
          break;
        case 'user_left':
          console.log('[Team Chat] User left:', data.data.userId);
          break;
        case 'error':
          toast({
            title: "Error",
            description: data.error,
            variant: "destructive",
          });
          break;
      }
    };

    websocket.onerror = (error) => {
      console.error('[Team Chat] WebSocket error:', error);
      setIsConnected(false);
    };

    websocket.onclose = () => {
      console.log('[Team Chat] WebSocket disconnected');
      setIsConnected(false);
    };

    setWs(websocket);

    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ type: 'leave_team' }));
      }
      websocket.close();
    };
  }, [teamId]);

  const handleSend = () => {
    if (!message.trim() || !ws || !isConnected) return;

    ws.send(JSON.stringify({
      type: 'send_message',
      message: message.trim(),
      metadata: {},
    }));

    setMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="flex flex-col h-[500px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Team Chat - {teamName}
          {isConnected && (
            <span className="text-xs text-green-600 dark:text-green-400">● Connected</span>
          )}
          {!isConnected && (
            <span className="text-xs text-red-600 dark:text-red-400">● Disconnected</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-3">
            {localMessages.map((msg) => (
              <div
                key={msg.id}
                className="flex flex-col gap-1"
                data-testid={`message-${msg.id}`}
              >
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    User {msg.senderId.substring(0, 8)}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={!isConnected}
            data-testid="input-chat-message"
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || !isConnected}
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

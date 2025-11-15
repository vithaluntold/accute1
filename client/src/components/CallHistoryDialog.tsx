import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CallLog {
  id: string;
  channelId: string | null;
  callerId: string;
  receiverId: string;
  callType: 'audio' | 'video';
  status: 'completed' | 'missed' | 'rejected' | 'failed';
  startedAt: string;
  endedAt: string | null;
  duration: number | null;
  caller: {
    id: string;
    name: string;
    email: string;
  } | null;
  receiver: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface CallHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  channelId?: string;
}

export default function CallHistoryDialog({ isOpen, onClose, channelId }: CallHistoryDialogProps) {
  const { data: callLogs = [] } = useQuery<CallLog[]>({
    queryKey: channelId ? ["/api/chat/channels", channelId, "call-logs"] : ["/api/call-logs"],
    enabled: isOpen,
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0s";
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <PhoneIncoming className="h-4 w-4 text-green-500" />;
      case 'missed':
        return <PhoneMissed className="h-4 w-4 text-red-500" />;
      case 'rejected':
        return <PhoneOff className="h-4 w-4 text-red-500" />;
      case 'failed':
        return <PhoneOff className="h-4 w-4 text-orange-500" />;
      default:
        return <Phone className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      missed: "destructive",
      rejected: "secondary",
      failed: "destructive",
    };
    return (
      <Badge variant={variants[status] || "outline"} className="text-xs">
        {status}
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]" data-testid="dialog-call-history">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Call History
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[600px] pr-4">
          {callLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Phone className="h-12 w-12 mb-4 opacity-50" />
              <p>No call history yet</p>
              <p className="text-sm">Start a call to see it here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {callLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 border rounded-md hover-elevate"
                  data-testid={`call-log-${log.id}`}
                >
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted">
                    {log.callType === 'video' ? (
                      <Video className="h-5 w-5" />
                    ) : (
                      <Phone className="h-5 w-5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex items-center gap-1">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {log.caller?.name?.substring(0, 2).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">
                          {log.caller?.name || log.caller?.email || 'Unknown'}
                        </span>
                      </div>
                      <PhoneOutgoing className="h-3 w-3 text-muted-foreground" />
                      <div className="flex items-center gap-1">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {log.receiver?.name?.substring(0, 2).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">
                          {log.receiver?.name || log.receiver?.email || 'Unknown'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {getStatusIcon(log.status)}
                      {getStatusBadge(log.status)}
                      <Badge variant="outline" className="text-xs">
                        {log.callType}
                      </Badge>
                      {log.duration && log.status === 'completed' && (
                        <span>{formatDuration(log.duration)}</span>
                      )}
                      <span>
                        {formatDistanceToNow(new Date(log.startedAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

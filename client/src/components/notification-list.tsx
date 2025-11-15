import { useQuery, useMutation } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { 
  Bell, 
  FileText, 
  CheckSquare, 
  FileSignature, 
  DollarSign,
  MessageSquare,
  AlertCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  actionUrl?: string;
  resourceType?: string;
  isRead: boolean;
  createdAt: string;
}

const typeIcons: Record<string, typeof Bell> = {
  task_assigned: CheckSquare,
  task_due_soon: AlertCircle,
  task_overdue: AlertCircle,
  document_shared: FileText,
  document_request: FileText,
  signature_request: FileSignature,
  form_request: FileText,
  payment_request: DollarSign,
  message_received: MessageSquare,
  workflow_updated: CheckSquare,
};

const priorityColors: Record<string, string> = {
  urgent: "destructive",
  high: "default",
  medium: "secondary",
  low: "outline",
};

interface NotificationListProps {
  onClose?: () => void;
}

export function NotificationList({ onClose }: NotificationListProps) {
  const [, setLocation] = useLocation();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: () => fetch("/api/notifications?limit=20").then(res => res.json()),
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest("PATCH", `/api/notifications/${notificationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markReadMutation.mutateAsync(notification.id);
    }

    if (notification.actionUrl) {
      setLocation(notification.actionUrl);
      onClose?.();
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Loading notifications...
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="p-8 text-center">
        <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">No notifications yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-96">
      <div className="divide-y">
        {notifications.map((notification) => {
          const Icon = typeIcons[notification.type] || Bell;
          const priorityColor = priorityColors[notification.priority] || "secondary";

          return (
            <div
              key={notification.id}
              className={`p-4 hover-elevate cursor-pointer ${
                !notification.isRead ? "bg-accent/50" : ""
              }`}
              onClick={() => handleNotificationClick(notification)}
              data-testid={`notification-${notification.id}`}
            >
              <div className="flex gap-3">
                <div className="mt-0.5">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium ${!notification.isRead ? "font-semibold" : ""}`}>
                      {notification.title}
                    </p>
                    <Badge variant={priorityColor as any} className="text-xs">
                      {notification.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

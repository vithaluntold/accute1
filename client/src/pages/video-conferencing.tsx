import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertMeetingRecordSchema, type MeetingRecord, type OAuthConnection } from "@shared/schema";
import { Video, Plus, Calendar, Users, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const meetingFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  provider: z.enum(["zoom", "google_meet", "microsoft_teams"]),
  date: z.string(),
  time: z.string(),
  duration: z.coerce.number().min(15).default(60),
  meetingUrl: z.string().optional(),
});

const PROVIDERS = [
  { id: 'google_meet', name: 'Google Meet', color: 'bg-blue-500' },
  { id: 'zoom', name: 'Zoom', color: 'bg-indigo-500' },
  { id: 'microsoft_teams', name: 'Microsoft Teams', color: 'bg-purple-500' },
];

export default function VideoConferencingPage() {
  const { toast } = useToast();
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  const form = useForm<z.infer<typeof meetingFormSchema>>({
    resolver: zodResolver(meetingFormSchema),
    defaultValues: {
      title: "",
      description: "",
      provider: "zoom",
      date: new Date().toISOString().split("T")[0],
      time: "10:00",
      duration: 60,
      participants: [],
      meetingUrl: "",
    },
  });

  const { data: connections = [], refetch: refetchConnections } = useQuery<OAuthConnection[]>({
    queryKey: ["/api/oauth/connections"],
  });

  const { data: meetings = [], isLoading } = useQuery<MeetingRecord[]>({
    queryKey: ["/api/meetings"],
  });

  const createMeetingMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/meetings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      setShowNewMeeting(false);
      form.reset();
      toast({ title: "Meeting created successfully" });
    },
    onError: () => toast({ title: "Failed to create meeting", variant: "destructive" }),
  });

  const disconnectMutation = useMutation({
    mutationFn: async (provider: string) => apiRequest("DELETE", `/api/oauth/${provider}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/oauth/connections"] });
      toast({ title: "Provider disconnected successfully" });
    },
    onError: () => toast({ title: "Failed to disconnect provider", variant: "destructive" }),
  });

  // Handle OAuth popup messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'oauth_success') {
        toast({ title: `${event.data.provider} connected successfully!` });
        refetchConnections();
        setConnectingProvider(null);
      } else if (event.data.type === 'oauth_error') {
        toast({ 
          title: `Failed to connect ${event.data.provider}`, 
          description: event.data.error,
          variant: "destructive" 
        });
        setConnectingProvider(null);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [toast, refetchConnections]);

  const handleConnect = async (provider: string) => {
    try {
      setConnectingProvider(provider);
      const response = await fetch(`/api/oauth/${provider}/authorize`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        toast({ 
          title: "Failed to start OAuth", 
          description: error.error || "Unknown error",
          variant: "destructive" 
        });
        setConnectingProvider(null);
        return;
      }

      const { authUrl } = await response.json();
      const popup = window.open(authUrl, 'oauth', 'width=600,height=700');

      // Check if popup was blocked
      if (!popup) {
        toast({ 
          title: "Popup blocked", 
          description: "Please allow popups for this site",
          variant: "destructive" 
        });
        setConnectingProvider(null);
      }
    } catch (error) {
      toast({ title: "Failed to connect", variant: "destructive" });
      setConnectingProvider(null);
    }
  };

  const handleDisconnect = (provider: string) => {
    disconnectMutation.mutate(provider);
  };

  const isConnected = (providerId: string) => {
    return connections.some(c => c.provider === providerId && c.status === 'active');
  };

  const onSubmit = (data: z.infer<typeof meetingFormSchema>) => {
    const startTime = new Date(`${data.date}T${data.time}`);
    const endTime = new Date(startTime.getTime() + Number(data.duration) * 60000);

    createMeetingMutation.mutate({
      title: data.title,
      description: data.description || null,
      provider: data.provider,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: Number(data.duration),
      participants: [],
      meetingUrl: data.meetingUrl || `https://zoom.us/j/${Math.random().toString(36).substring(7)}`,
      status: "scheduled",
    });
  };

  const upcomingMeetings = meetings.filter(
    (m) => m.status === "scheduled" && new Date(m.startTime) > new Date()
  );
  const pastMeetings = meetings.filter(
    (m) => m.status === "completed" || new Date(m.startTime) <= new Date()
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-4 border-b">
        <div className="flex items-center gap-2">
          <Video className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Video Conferencing</h1>
        </div>
        <Dialog open={showNewMeeting} onOpenChange={setShowNewMeeting}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-meeting">
              <Plus className="w-4 h-4" />
              Schedule Meeting
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Schedule New Meeting</DialogTitle>
              <DialogDescription>Create a video conference meeting</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meeting Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Q1 Planning Meeting" {...field} data-testid="input-meeting-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Meeting agenda and details..."
                          rows={3}
                          {...field}
                          value={field.value || ""}
                          data-testid="input-meeting-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="provider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Provider</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-provider">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="zoom">Zoom</SelectItem>
                            <SelectItem value="google_meet">Google Meet</SelectItem>
                            <SelectItem value="microsoft_teams">Microsoft Teams</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (minutes)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="15"
                            step="15"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            data-testid="input-duration"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} data-testid="input-time" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={createMeetingMutation.isPending} data-testid="button-create-meeting">
                    Schedule Meeting
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setShowNewMeeting(false); form.reset(); }} data-testid="button-cancel">
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Connected Accounts</CardTitle>
            <CardDescription>Manage your video conferencing integrations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PROVIDERS.map((provider) => {
                const connected = isConnected(provider.id);
                const isConnecting = connectingProvider === provider.id;

                return (
                  <Card key={provider.id} data-testid={`card-provider-${provider.id}`}>
                    <CardHeader className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${provider.color}`}></div>
                          <CardTitle className="text-base">{provider.name}</CardTitle>
                        </div>
                        {connected ? (
                          <Badge variant="default" className="gap-1" data-testid={`badge-status-${provider.id}`}>
                            <CheckCircle2 className="w-3 h-3" />
                            Connected
                          </Badge>
                        ) : (
                          <Badge variant="secondary" data-testid={`badge-status-${provider.id}`}>
                            <XCircle className="w-3 h-3" />
                            Not Connected
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {connected ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleDisconnect(provider.id)}
                          disabled={disconnectMutation.isPending}
                          data-testid={`button-disconnect-${provider.id}`}
                        >
                          Disconnect
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full"
                          onClick={() => handleConnect(provider.id)}
                          disabled={isConnecting}
                          data-testid={`button-connect-${provider.id}`}
                        >
                          {isConnecting ? "Connecting..." : "Connect"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-lg font-semibold mb-3" data-testid="text-upcoming-title">Upcoming Meetings</h2>
          {isLoading ? (
            <p className="text-muted-foreground" data-testid="text-loading">Loading meetings...</p>
          ) : upcomingMeetings.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-32">
                <p className="text-muted-foreground" data-testid="text-no-upcoming">No upcoming meetings scheduled</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingMeetings.map((meeting) => (
                <Card key={meeting.id} data-testid={`card-meeting-${meeting.id}`}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between gap-2">
                      <span data-testid={`text-meeting-title-${meeting.id}`}>{meeting.title}</span>
                      <Badge variant="outline" data-testid={`badge-provider-${meeting.id}`}>{meeting.provider}</Badge>
                    </CardTitle>
                    <CardDescription className="text-xs" data-testid={`text-meeting-time-${meeting.id}`}>
                      {new Date(meeting.startTime).toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {meeting.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-meeting-desc-${meeting.id}`}>
                        {meeting.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span data-testid={`text-meeting-duration-${meeting.id}`}>{meeting.duration} minutes</span>
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => window.open(meeting.meetingUrl, "_blank")}
                      data-testid={`button-join-${meeting.id}`}
                    >
                      <ExternalLink className="w-3 h-3" />
                      Join Meeting
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {pastMeetings.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3" data-testid="text-past-title">Past Meetings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pastMeetings.slice(0, 6).map((meeting) => (
                <Card key={meeting.id} className="opacity-75" data-testid={`card-past-meeting-${meeting.id}`}>
                  <CardHeader>
                    <CardTitle className="text-base" data-testid={`text-past-meeting-title-${meeting.id}`}>{meeting.title}</CardTitle>
                    <CardDescription className="text-xs" data-testid={`text-past-meeting-time-${meeting.id}`}>
                      {new Date(meeting.startTime).toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary" data-testid={`badge-past-status-${meeting.id}`}>Completed</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

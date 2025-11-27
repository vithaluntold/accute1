import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Video, 
  Mic, 
  MicOff, 
  Square, 
  Play, 
  Pause, 
  Trash2, 
  Upload, 
  Settings, 
  Clock,
  Eye,
  Share2,
  Plus,
  Search,
  Filter,
  Grid3X3,
  List,
  Download,
  MonitorPlay,
  FileText,
  Tag,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react";
import type { TaskRecording } from "@shared/schema";

type RecordingStatus = "idle" | "recording" | "paused" | "stopped";

async function generateThumbnail(videoBlob: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(video.duration * 0.1, 2);
    };

    video.onseeked = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(video.src);
          resolve(blob);
        }, "image/png", 0.8);
      } else {
        URL.revokeObjectURL(video.src);
        resolve(null);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(null);
    };

    video.src = URL.createObjectURL(videoBlob);
  });
}

export default function RecordingsPage() {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>("idle");
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<TaskRecording | null>(null);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [recordingTitle, setRecordingTitle] = useState("");
  const [recordingDescription, setRecordingDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timer | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const { data: recordings, isLoading } = useQuery<TaskRecording[]>({
    queryKey: ["/api/recordings"],
  });

  const createRecordingMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; hasAudio?: boolean }) => {
      const response = await apiRequest("POST", "/api/recordings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
    },
  });

  const uploadRecordingMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: FormData }) => {
      const response = await fetch(`/api/recordings/${id}/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error("Upload failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
      toast({
        title: "Recording saved",
        description: "Your recording has been uploaded successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Failed to upload recording. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteRecordingMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/recordings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
      toast({
        title: "Recording deleted",
        description: "The recording has been deleted.",
      });
    },
  });

  const startRecording = useCallback(async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true,
      });

      let finalStream = displayStream;

      if (includeAudio) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const audioTracks = audioStream.getAudioTracks();
          audioTracks.forEach(track => displayStream.addTrack(track));
        } catch (audioError) {
          console.warn("Could not capture microphone audio:", audioError);
        }
      }

      streamRef.current = finalStream;
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(finalStream, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") 
          ? "video/webm;codecs=vp9" 
          : "video/webm",
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
        }

        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        
        if (blob.size > 0 && recordingTitle.trim()) {
          try {
            const recording = await createRecordingMutation.mutateAsync({
              title: recordingTitle,
              description: recordingDescription,
              hasAudio: includeAudio,
            });

            const formData = new FormData();
            formData.append("video", blob, "recording.webm");
            formData.append("videoDuration", String(recordingDuration));
            formData.append("hasAudio", String(includeAudio));
            formData.append("resolution", "1920x1080");

            try {
              const thumbnailBlob = await generateThumbnail(blob);
              if (thumbnailBlob) {
                formData.append("thumbnail", thumbnailBlob, "thumbnail.png");
              }
            } catch (thumbError) {
              console.warn("Could not generate thumbnail:", thumbError);
            }

            await uploadRecordingMutation.mutateAsync({ 
              id: recording.id, 
              formData 
            });
          } catch (error) {
            console.error("Upload failed:", error);
            toast({
              title: "Upload failed",
              description: "Could not upload recording. Please try again.",
              variant: "destructive",
            });
          }
        }

        streamRef.current?.getTracks().forEach(track => track.stop());
        setRecordingStatus("idle");
        setRecordingDuration(0);
        setShowRecordDialog(false);
        setRecordingTitle("");
        setRecordingDescription("");
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      
      setRecordingStatus("recording");
      setIsRecording(true);

      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      displayStream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };

    } catch (error) {
      console.error("Failed to start recording:", error);
      toast({
        title: "Recording failed",
        description: "Could not start screen recording. Please check permissions.",
        variant: "destructive",
      });
    }
  }, [includeAudio, recordingTitle, recordingDescription, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingStatus === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [recordingStatus]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingStatus === "recording") {
      mediaRecorderRef.current.pause();
      setRecordingStatus("paused");
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    }
  }, [recordingStatus]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingStatus === "paused") {
      mediaRecorderRef.current.resume();
      setRecordingStatus("recording");
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    }
  }, [recordingStatus]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const filteredRecordings = recordings?.filter(r => 
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Task Recordings</h1>
          <p className="text-muted-foreground">
            Record screen and audio to document workflows and train AI
          </p>
        </div>
        <Button 
          onClick={() => setShowRecordDialog(true)} 
          data-testid="button-new-recording"
          className="gap-2"
        >
          <Video className="h-4 w-4" />
          New Recording
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search recordings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("grid")}
            data-testid="button-view-grid"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("list")}
            data-testid="button-view-list"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-0">
                <Skeleton className="h-40 w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredRecordings?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Video className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No recordings yet</h3>
            <p className="text-muted-foreground text-center max-w-sm mt-1">
              Record your screen to document workflows, create training materials, or share procedures with your team.
            </p>
            <Button 
              onClick={() => setShowRecordDialog(true)} 
              className="mt-4"
              data-testid="button-start-first-recording"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create your first recording
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRecordings?.map((recording) => (
            <Card 
              key={recording.id} 
              className="overflow-hidden hover-elevate cursor-pointer"
              onClick={() => {
                setSelectedRecording(recording);
                setShowViewDialog(true);
              }}
              data-testid={`card-recording-${recording.id}`}
            >
              <div className="relative aspect-video bg-muted flex items-center justify-center">
                {recording.thumbnailUrl ? (
                  <img 
                    src={recording.thumbnailUrl} 
                    alt={recording.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <MonitorPlay className="h-12 w-12 text-muted-foreground" />
                )}
                {recording.videoDuration && (
                  <Badge className="absolute bottom-2 right-2 bg-black/70">
                    {formatDuration(recording.videoDuration)}
                  </Badge>
                )}
                <Badge 
                  className="absolute top-2 left-2"
                  variant={
                    recording.status === "ready" ? "default" : 
                    recording.status === "failed" ? "destructive" : "secondary"
                  }
                >
                  {recording.status === "ready" ? (
                    <><CheckCircle className="h-3 w-3 mr-1" /> Ready</>
                  ) : recording.status === "processing" ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processing</>
                  ) : recording.status === "failed" ? (
                    <><XCircle className="h-3 w-3 mr-1" /> Failed</>
                  ) : (
                    <><Clock className="h-3 w-3 mr-1" /> Draft</>
                  )}
                </Badge>
              </div>
              <CardContent className="p-4">
                <h3 className="font-medium truncate" data-testid={`text-recording-title-${recording.id}`}>
                  {recording.title}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {recording.description || "No description"}
                </p>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  {recording.hasAudio && <Mic className="h-3 w-3" />}
                  <Clock className="h-3 w-3" />
                  {new Date(recording.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRecordings?.map((recording) => (
            <Card 
              key={recording.id}
              className="hover-elevate cursor-pointer"
              onClick={() => {
                setSelectedRecording(recording);
                setShowViewDialog(true);
              }}
              data-testid={`row-recording-${recording.id}`}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-24 h-16 bg-muted rounded flex items-center justify-center shrink-0">
                  {recording.thumbnailUrl ? (
                    <img 
                      src={recording.thumbnailUrl} 
                      alt={recording.title}
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <MonitorPlay className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{recording.title}</h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {recording.description || "No description"}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
                  {recording.videoDuration && (
                    <span>{formatDuration(recording.videoDuration)}</span>
                  )}
                  <Badge variant={
                    recording.status === "ready" ? "default" : 
                    recording.status === "failed" ? "destructive" : "secondary"
                  }>
                    {recording.status === "ready" ? "Ready" : 
                     recording.status === "processing" ? "Processing" :
                     recording.status === "failed" ? "Failed" : "Draft"}
                  </Badge>
                  <span>{new Date(recording.createdAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showRecordDialog} onOpenChange={setShowRecordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {recordingStatus === "idle" ? "Start New Recording" : "Recording in Progress"}
            </DialogTitle>
            <DialogDescription>
              {recordingStatus === "idle" 
                ? "Record your screen to document a workflow or procedure."
                : `Recording: ${formatDuration(recordingDuration)}`
              }
            </DialogDescription>
          </DialogHeader>

          {recordingStatus === "idle" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recording-title">Title</Label>
                <Input
                  id="recording-title"
                  placeholder="e.g., Monthly Tax Filing Procedure"
                  value={recordingTitle}
                  onChange={(e) => setRecordingTitle(e.target.value)}
                  data-testid="input-recording-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recording-description">Description (optional)</Label>
                <Textarea
                  id="recording-description"
                  placeholder="Describe what this recording covers..."
                  value={recordingDescription}
                  onChange={(e) => setRecordingDescription(e.target.value)}
                  data-testid="input-recording-description"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Include microphone audio</Label>
                  <p className="text-xs text-muted-foreground">
                    Record your voice along with screen
                  </p>
                </div>
                <Switch
                  checked={includeAudio}
                  onCheckedChange={setIncludeAudio}
                  data-testid="switch-include-audio"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-8">
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <div className="w-4 h-4 bg-destructive rounded-full animate-pulse" />
              </div>
              <p className="text-2xl font-mono font-bold">
                {formatDuration(recordingDuration)}
              </p>
              <p className="text-muted-foreground mt-2">
                {recordingStatus === "paused" ? "Paused" : "Recording..."}
              </p>
            </div>
          )}

          <DialogFooter>
            {recordingStatus === "idle" ? (
              <>
                <Button variant="outline" onClick={() => setShowRecordDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={startRecording}
                  disabled={!recordingTitle.trim()}
                  className="gap-2"
                  data-testid="button-start-recording"
                >
                  <Video className="h-4 w-4" />
                  Start Recording
                </Button>
              </>
            ) : (
              <div className="flex gap-2 w-full justify-center">
                {recordingStatus === "recording" ? (
                  <Button variant="outline" onClick={pauseRecording} className="gap-2">
                    <Pause className="h-4 w-4" />
                    Pause
                  </Button>
                ) : (
                  <Button variant="outline" onClick={resumeRecording} className="gap-2">
                    <Play className="h-4 w-4" />
                    Resume
                  </Button>
                )}
                <Button 
                  variant="destructive" 
                  onClick={stopRecording}
                  className="gap-2"
                  data-testid="button-stop-recording"
                >
                  <Square className="h-4 w-4" />
                  Stop & Save
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-3xl">
          {selectedRecording && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedRecording.title}</DialogTitle>
                <DialogDescription>
                  {selectedRecording.description || "No description provided"}
                </DialogDescription>
              </DialogHeader>

              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                {selectedRecording.status === "processing" ? (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <div className="text-center">
                      <Loader2 className="h-16 w-16 mx-auto mb-4 animate-spin opacity-50" />
                      <p className="font-medium">Processing Recording</p>
                      <p className="text-sm opacity-75 mt-1">This may take a few minutes...</p>
                    </div>
                  </div>
                ) : selectedRecording.status === "failed" ? (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <div className="text-center">
                      <XCircle className="h-16 w-16 mx-auto mb-4 text-red-400" />
                      <p className="font-medium">Processing Failed</p>
                      <p className="text-sm opacity-75 mt-1">
                        {selectedRecording.processingError || "An error occurred while processing"}
                      </p>
                    </div>
                  </div>
                ) : selectedRecording.videoUrl ? (
                  <video
                    ref={videoPreviewRef}
                    src={selectedRecording.videoUrl}
                    controls
                    className="w-full h-full"
                    data-testid="video-player"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <div className="text-center">
                      <MonitorPlay className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">Video Pending</p>
                      <p className="text-sm opacity-75 mt-1">Recording saved as draft</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Duration:</span>{" "}
                  {selectedRecording.videoDuration 
                    ? formatDuration(selectedRecording.videoDuration)
                    : "Unknown"}
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>{" "}
                  {new Date(selectedRecording.createdAt).toLocaleString()}
                </div>
                <div>
                  <span className="text-muted-foreground">Audio:</span>{" "}
                  {selectedRecording.hasAudio ? "Yes" : "No"}
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <Badge variant={
                    selectedRecording.status === "ready" ? "default" : 
                    selectedRecording.status === "failed" ? "destructive" : "secondary"
                  }>
                    {selectedRecording.status}
                  </Badge>
                </div>
              </div>

              {selectedRecording.transcript && (
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    AI-Generated Transcript
                  </h4>
                  <ScrollArea className="h-32 border rounded-md p-3">
                    <p className="text-sm">{selectedRecording.transcript}</p>
                  </ScrollArea>
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this recording?")) {
                      deleteRecordingMutation.mutate(selectedRecording.id);
                      setShowViewDialog(false);
                    }
                  }}
                  className="gap-2"
                  data-testid="button-delete-recording"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
                <Button variant="outline" className="gap-2">
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
                {selectedRecording.videoUrl && selectedRecording.status === "ready" && (
                  <Button asChild className="gap-2">
                    <a href={selectedRecording.videoUrl} download>
                      <Download className="h-4 w-4" />
                      Download
                    </a>
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

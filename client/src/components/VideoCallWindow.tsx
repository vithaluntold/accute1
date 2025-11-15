import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff, 
  Monitor,
  MonitorOff,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { CallType, CallState } from '@/hooks/useWebRTC';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface VideoCallWindowProps {
  callState: CallState;
  callType: CallType;
  remoteUserName: string | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onHangUp: () => void;
  className?: string;
}

export function VideoCallWindow({
  callState,
  callType,
  remoteUserName,
  isAudioMuted,
  isVideoMuted,
  isScreenSharing,
  localStream,
  remoteStream,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onHangUp,
  className,
}: VideoCallWindowProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Update local video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Update remote video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const showVideo = callType === 'video';
  const isConnecting = callState === 'connecting' || callState === 'initiating';
  const isActive = callState === 'active';

  return (
    <Card
      className={cn(
        'overflow-hidden bg-background/95 backdrop-blur',
        isFullscreen ? 'fixed inset-4 z-50' : 'relative h-[500px]',
        className
      )}
      data-testid="video-call-window"
    >
      <div className="relative h-full flex flex-col">
        {/* Remote video (main view) */}
        <div className="relative flex-1 bg-muted/30">
          {showVideo ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              data-testid="video-remote"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <span className="text-4xl font-semibold text-primary">
                    {remoteUserName?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <p className="text-lg font-medium">{remoteUserName || 'Connecting...'}</p>
                  <p className="text-sm text-muted-foreground">
                    {isConnecting ? 'Connecting...' : isActive ? 'Audio call' : 'Waiting...'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Connection status overlay */}
          {isConnecting && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Connecting...</p>
              </div>
            </div>
          )}

          {/* Local video (picture-in-picture) */}
          {showVideo && (
            <div className="absolute bottom-4 right-4 w-48 h-36 bg-muted rounded-lg overflow-hidden border-2 border-border shadow-lg">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirror"
                data-testid="video-local"
              />
              {isVideoMuted && (
                <div className="absolute inset-0 bg-muted/90 flex items-center justify-center">
                  <VideoOff className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </div>
          )}

          {/* Fullscreen toggle */}
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-4 right-4 bg-background/50 hover:bg-background/80"
            onClick={toggleFullscreen}
            data-testid="button-fullscreen-toggle"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Call controls */}
        <div className="p-4 bg-background border-t">
          <div className="flex items-center justify-center gap-2">
            {/* Audio toggle */}
            <Button
              size="icon"
              variant={isAudioMuted ? 'destructive' : 'default'}
              onClick={onToggleAudio}
              data-testid="button-toggle-audio"
            >
              {isAudioMuted ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </Button>

            {/* Video toggle (only for video calls) */}
            {showVideo && (
              <Button
                size="icon"
                variant={isVideoMuted ? 'destructive' : 'default'}
                onClick={onToggleVideo}
                data-testid="button-toggle-video"
              >
                {isVideoMuted ? (
                  <VideoOff className="w-4 h-4" />
                ) : (
                  <Video className="w-4 h-4" />
                )}
              </Button>
            )}

            {/* Screen share toggle (only for video calls) */}
            {showVideo && (
              <Button
                size="icon"
                variant={isScreenSharing ? 'secondary' : 'ghost'}
                onClick={onToggleScreenShare}
                data-testid="button-toggle-screenshare"
              >
                {isScreenSharing ? (
                  <MonitorOff className="w-4 h-4" />
                ) : (
                  <Monitor className="w-4 h-4" />
                )}
              </Button>
            )}

            {/* Hang up */}
            <Button
              size="icon"
              variant="destructive"
              onClick={onHangUp}
              className="ml-2"
              data-testid="button-hangup"
            >
              <PhoneOff className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </Card>
  );
}

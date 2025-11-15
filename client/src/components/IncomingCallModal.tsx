import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Video, PhoneMissed } from 'lucide-react';
import { CallType } from '@/hooks/useWebRTC';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useEffect, useState, useRef } from 'react';

interface IncomingCallModalProps {
  isOpen: boolean;
  callerName: string;
  callType: CallType;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallModal({
  isOpen,
  callerName,
  callType,
  onAccept,
  onReject,
}: IncomingCallModalProps) {
  const [ringCount, setRingCount] = useState(0);
  const handledRef = useRef(false);

  // Reset handled flag when new call arrives
  useEffect(() => {
    if (isOpen) {
      handledRef.current = false;
    }
  }, [isOpen]);

  // Animate ring effect
  useEffect(() => {
    if (!isOpen) {
      setRingCount(0);
      return;
    }

    const interval = setInterval(() => {
      setRingCount((prev) => (prev + 1) % 4);
    }, 800);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Play ring sound (optional - can be implemented later)
  useEffect(() => {
    if (isOpen) {
      // TODO: Play ring sound
      console.log('[IncomingCall] Ringing...');
    }
  }, [isOpen]);

  const handleAccept = () => {
    if (handledRef.current) return;
    handledRef.current = true;
    onAccept();
    // Parent handles clearing incomingCall, which closes modal
  };

  const handleReject = () => {
    if (handledRef.current) return;
    handledRef.current = true;
    onReject();
    // Parent handles clearing incomingCall, which closes modal
  };

  const handleOpenChange = (open: boolean) => {
    // Only reject if user is trying to close (Escape/outside click)
    // AND we haven't already handled this call (accept/reject)
    if (!open && !handledRef.current) {
      handleReject();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="sm:max-w-md"
        data-testid="modal-incoming-call"
      >
        <DialogHeader>
          <DialogTitle>
            {callType === 'video' ? 'Incoming Video Call' : 'Incoming Call'}
          </DialogTitle>
          <DialogDescription>
            Answer the call to connect
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-6">
          {/* Caller avatar with ring animation */}
          <div className="relative">
            <div 
              className="absolute inset-0 rounded-full bg-primary/20 animate-ping"
              style={{
                animationDuration: '2s',
                opacity: ringCount % 2 === 0 ? 0.5 : 0,
              }}
            />
            <Avatar className="w-24 h-24 border-4 border-primary/30">
              <AvatarFallback className="text-2xl bg-primary/10">
                {callerName[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Caller name */}
          <div className="text-center">
            <p className="text-lg font-semibold" data-testid="text-caller-name">
              {callerName}
            </p>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2 mt-1">
              {callType === 'video' ? (
                <>
                  <Video className="w-4 h-4" />
                  <span>Video call</span>
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4" />
                  <span>Voice call</span>
                </>
              )}
            </p>
          </div>

          {/* Ringing animation */}
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-primary"
                style={{
                  opacity: ringCount === i ? 1 : 0.3,
                  transition: 'opacity 0.3s',
                }}
              />
            ))}
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          {/* Reject button */}
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleReject}
            data-testid="button-reject-call"
          >
            <PhoneOff className="w-4 h-4 mr-2" />
            Decline
          </Button>

          {/* Accept button */}
          <Button
            variant="default"
            className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={handleAccept}
            data-testid="button-accept-call"
          >
            <Phone className="w-4 h-4 mr-2" />
            Answer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

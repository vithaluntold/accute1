import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Shield, KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MFAVerificationModalProps {
  open: boolean;
  userId: string;
  deviceId: string;
  onSuccess: (data: {
    user: any;
    role: any;
    token: string;
    isFirstLogin?: boolean;
  }) => void;
  onCancel: () => void;
}

export function MFAVerificationModal({
  open,
  userId,
  deviceId,
  onSuccess,
  onCancel,
}: MFAVerificationModalProps) {
  const { toast } = useToast();
  const [token, setToken] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);

  // Verify TOTP token
  const verifyToken = useMutation({
    mutationFn: async (code: string) => {
      const deviceName = `${navigator.platform} - ${new Date().toLocaleDateString()}`;
      
      const response = await apiRequest(
        'POST',
        '/api/auth/login/mfa',
        {
          userId,
          token: code,
          trustDevice,
          deviceId,
          deviceName,
        }
      );
      return response.json();
    },
    onSuccess: (data) => {
      onSuccess(data); // Parent will show the appropriate welcome message
      // Reset state
      setToken('');
      setBackupCode('');
      setTrustDevice(false);
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid code",
        variant: "destructive",
      });
    },
  });

  // Verify backup code (now completes login directly)
  const verifyBackupCode = useMutation({
    mutationFn: async (code: string) => {
      const deviceName = `${navigator.platform} - ${new Date().toLocaleDateString()}`;
      
      // Verify backup code and complete login in one call
      const response = await apiRequest(
        'POST',
        '/api/mfa/verify-backup-code',
        {
          userId,
          backupCode: code,
          deviceId,
          deviceName,
        }
      );
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Backup Code Accepted",
        description: "Remember: each backup code can only be used once",
      });
      onSuccess(data);
      // Reset state
      setToken('');
      setBackupCode('');
      setTrustDevice(false);
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid or already used backup code",
        variant: "destructive",
      });
    },
  });

  const handleVerifyToken = () => {
    if (token.length === 6) {
      verifyToken.mutate(token);
    }
  };

  const handleVerifyBackupCode = () => {
    if (backupCode.length >= 8) {
      verifyBackupCode.mutate(backupCode.toUpperCase());
    }
  };

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-md" data-testid="dialog-mfa-verification">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>
            Enter your verification code to continue
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="totp" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="totp" data-testid="tab-totp">
              Authenticator App
            </TabsTrigger>
            <TabsTrigger value="backup" data-testid="tab-backup">
              Backup Code
            </TabsTrigger>
          </TabsList>

          {/* TOTP Verification */}
          <TabsContent value="totp" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="totp-token">6-Digit Code</Label>
              <Input
                id="totp-token"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest font-mono"
                data-testid="input-totp-token"
              />
              <p className="text-xs text-muted-foreground">
                Open your authenticator app and enter the current code
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="trust-device"
                checked={trustDevice}
                onCheckedChange={(checked) => setTrustDevice(checked as boolean)}
                data-testid="checkbox-trust-device"
              />
              <Label
                htmlFor="trust-device"
                className="text-sm font-normal cursor-pointer"
              >
                Trust this device for 30 days
              </Label>
            </div>

            <Button
              onClick={handleVerifyToken}
              disabled={token.length !== 6 || verifyToken.isPending}
              className="w-full"
              data-testid="button-verify-totp"
            >
              {verifyToken.isPending ? "Verifying..." : "Verify Code"}
            </Button>
          </TabsContent>

          {/* Backup Code Verification */}
          <TabsContent value="backup" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="backup-code">Backup Code</Label>
              <Input
                id="backup-code"
                type="text"
                maxLength={16}
                placeholder="XXXXXXXX"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                className="text-center text-xl tracking-wider font-mono"
                data-testid="input-backup-code"
              />
              <p className="text-xs text-muted-foreground">
                Each backup code can only be used once
              </p>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Backup codes were provided when you set up MFA
              </p>
            </div>

            <Button
              onClick={handleVerifyBackupCode}
              disabled={backupCode.length < 8 || verifyBackupCode.isPending}
              className="w-full"
              data-testid="button-verify-backup"
            >
              {verifyBackupCode.isPending ? "Verifying..." : "Use Backup Code"}
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} data-testid="button-cancel-verification">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Shield, Copy, Check, Download } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";

interface MFASetupDialogProps {
  open: boolean;
  onClose: () => void;
}

export function MFASetupDialog({ open, onClose }: MFASetupDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'setup' | 'verify'>('setup');
  const [setupData, setSetupData] = useState<{
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
  } | null>(null);
  const [verificationToken, setVerificationToken] = useState('');
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Step 1: Setup MFA
  const setupMFA = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/mfa/setup');
      const response = await res.json() as {
        success: boolean;
        secret: string;
        qrCodeUrl: string;
        backupCodes: string[];
      };
      return response;
    },
    onSuccess: (data) => {
      setSetupData(data);
      setStep('verify');
      toast({
        title: "MFA Setup Initialized",
        description: "Scan the QR code with your authenticator app",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to setup MFA",
        variant: "destructive",
      });
    },
  });

  // Step 2: Verify and enable MFA
  const verifyMFA = useMutation({
    mutationFn: async (token: string) => {
      const res = await apiRequest('POST', '/api/mfa/verify-setup', { token });
      const response = await res.json() as { success: boolean; message: string };
      return response;
    },
    onSuccess: () => {
      toast({
        title: "MFA Enabled",
        description: "Two-factor authentication is now active",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/mfa/status'] });
      onClose();
      // Reset state
      setStep('setup');
      setSetupData(null);
      setVerificationToken('');
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid verification code",
        variant: "destructive",
      });
    },
  });

  const handleCopyBackupCodes = () => {
    if (!setupData) return;
    const text = setupData.backupCodes.join('\n');
    navigator.clipboard.writeText(text);
    setCopiedBackupCodes(true);
    setTimeout(() => setCopiedBackupCodes(false), 2000);
    toast({
      title: "Copied to Clipboard",
      description: "Save these codes in a secure location",
    });
  };

  const handleCopySecret = () => {
    if (!setupData) return;
    navigator.clipboard.writeText(setupData.secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleDownloadBackupCodes = () => {
    if (!setupData) return;
    const text = `Accute - MFA Backup Codes\n\nDate: ${new Date().toLocaleDateString()}\n\n${setupData.backupCodes.join('\n')}\n\nKeep these codes safe. Each code can only be used once.`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accute-backup-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleVerify = () => {
    if (verificationToken.length === 6) {
      verifyMFA.mutate(verificationToken);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-mfa-setup">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Enable Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>
            {step === 'setup' && "Add an extra layer of security to your account"}
            {step === 'verify' && "Verify your authenticator app"}
          </DialogDescription>
        </DialogHeader>

        {step === 'setup' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Step 1: Download an Authenticator App</CardTitle>
                <CardDescription>
                  Install one of these apps on your phone:
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Google Authenticator</Badge>
                  <Badge variant="outline">Authy</Badge>
                  <Badge variant="outline">Microsoft Authenticator</Badge>
                  <Badge variant="outline">1Password</Badge>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={() => setupMFA.mutate()}
              disabled={setupMFA.isPending}
              className="w-full"
              data-testid="button-setup-mfa"
            >
              {setupMFA.isPending ? "Initializing..." : "Continue to Setup"}
            </Button>
          </div>
        )}

        {step === 'verify' && setupData && (
          <div className="space-y-6">
            {/* QR Code Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Step 2: Scan QR Code</CardTitle>
                <CardDescription>
                  Open your authenticator app and scan this code
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <img
                  src={setupData.qrCodeUrl}
                  alt="MFA QR Code"
                  className="w-48 h-48 border rounded-lg"
                  data-testid="img-mfa-qr-code"
                />
                
                <div className="w-full space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Or enter this code manually:
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={setupData.secret}
                      readOnly
                      className="font-mono text-sm"
                      data-testid="input-mfa-secret"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={handleCopySecret}
                      data-testid="button-copy-secret"
                    >
                      {copiedSecret ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Backup Codes Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Step 3: Save Backup Codes</CardTitle>
                <CardDescription>
                  Store these codes securely. Each code can only be used once.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
                  {setupData.backupCodes.map((code, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-muted-foreground">{index + 1}.</span>
                      <span data-testid={`text-backup-code-${index}`}>{code}</span>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCopyBackupCodes}
                    className="flex-1"
                    data-testid="button-copy-backup-codes"
                  >
                    {copiedBackupCodes ? (
                      <><Check className="w-4 h-4 mr-2" /> Copied</>
                    ) : (
                      <><Copy className="w-4 h-4 mr-2" /> Copy Codes</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDownloadBackupCodes}
                    className="flex-1"
                    data-testid="button-download-backup-codes"
                  >
                    <Download className="w-4 h-4 mr-2" /> Download
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Verification Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Step 4: Verify Code</CardTitle>
                <CardDescription>
                  Enter the 6-digit code from your authenticator app
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="verification-token">Verification Code</Label>
                  <Input
                    id="verification-token"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={verificationToken}
                    onChange={(e) => setVerificationToken(e.target.value.replace(/\D/g, ''))}
                    className="text-center text-2xl tracking-widest font-mono"
                    data-testid="input-verification-token"
                  />
                </div>

                <Button
                  onClick={handleVerify}
                  disabled={verificationToken.length !== 6 || verifyMFA.isPending}
                  className="w-full"
                  data-testid="button-verify-mfa"
                >
                  {verifyMFA.isPending ? "Verifying..." : "Enable MFA"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-mfa">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

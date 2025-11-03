import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Download, QrCode, Chrome, AppWindow, Share2, Plus, CheckCircle2, Package } from "lucide-react";
import { SiApple, SiAndroid } from "react-icons/si";
import { useMobileDetect, useIsPWA } from "@/hooks/use-mobile-detect";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

export default function MobileAppsPage() {
  const { isMobile, isTablet } = useMobileDetect();
  const isPWA = useIsPWA();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // Fetch mobile app download info
  const { data: appInfo } = useQuery<any>({
    queryKey: ["/api/mobile-apps/info"],
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  };

  const isAndroid = () => {
    return /Android/.test(navigator.userAgent);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Mobile Apps</h1>
        <p className="text-muted-foreground" data-testid="text-page-description">
          Install Accute on your mobile device for a native app experience
        </p>
      </div>

      {/* Status Card */}
      {isPWA && (
        <Card className="mb-6 border-green-500 dark:border-green-700" data-testid="card-installed-status">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <CardTitle className="text-green-600 dark:text-green-400">App Installed</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You're using Accute as an installed app. Enjoy the full native experience!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Native App Downloads */}
      {(appInfo?.android?.available || appInfo?.ios?.available) && (
        <Card className="mb-6 border-purple-500 dark:border-purple-700" data-testid="card-native-downloads">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <CardTitle className="text-purple-600 dark:text-purple-400">Native App Downloads</CardTitle>
            </div>
            <CardDescription>Download and install the native mobile apps</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {appInfo?.android?.available && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SiAndroid className="h-5 w-5 text-green-600" />
                      <span className="font-semibold">Android APK</span>
                    </div>
                    <Badge variant="outline">{appInfo.android.sizeFormatted}</Badge>
                  </div>
                  <Button 
                    onClick={() => window.location.href = appInfo.android.downloadUrl} 
                    className="w-full" 
                    variant="default"
                    data-testid="button-download-apk"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download APK
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    For Android 5.0 and above. Enable "Install from Unknown Sources" in settings.
                  </p>
                </div>
              )}
              
              {appInfo?.ios?.available && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SiApple className="h-5 w-5" />
                      <span className="font-semibold">iOS IPA</span>
                    </div>
                    <Badge variant="outline">{appInfo.ios.sizeFormatted}</Badge>
                  </div>
                  <Button 
                    onClick={() => window.location.href = appInfo.ios.downloadUrl} 
                    className="w-full" 
                    variant="default"
                    data-testid="button-download-ipa"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download IPA
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Requires TestFlight or enterprise signing. iOS 13.0 and above.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Install Button (if available) */}
      {!isPWA && isInstallable && (
        <Card className="mb-6" data-testid="card-quick-install">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Quick Install
            </CardTitle>
            <CardDescription>Install Accute with one click</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleInstallClick} size="lg" className="w-full" data-testid="button-quick-install">
              <Download className="h-4 w-4 mr-2" />
              Install App Now
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* iOS Installation */}
        <Card data-testid="card-ios-install">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SiApple className="h-6 w-6" />
                <CardTitle>iOS (iPhone/iPad)</CardTitle>
              </div>
              <Badge variant="outline" data-testid="badge-ios">Safari Required</Badge>
            </div>
            <CardDescription>Install from Safari browser</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  1
                </div>
                <div>
                  <p className="font-medium">Open in Safari</p>
                  <p className="text-sm text-muted-foreground">
                    Navigate to this page in Safari browser (iOS requirement)
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  2
                </div>
                <div>
                  <p className="font-medium">Tap Share Button</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    Tap the <Share2 className="h-4 w-4 inline" /> share icon at the bottom of Safari
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  3
                </div>
                <div>
                  <p className="font-medium">Add to Home Screen</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    Scroll down and tap <Plus className="h-4 w-4 inline" /> "Add to Home Screen"
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  4
                </div>
                <div>
                  <p className="font-medium">Confirm Installation</p>
                  <p className="text-sm text-muted-foreground">
                    Tap "Add" in the top right corner to install
                  </p>
                </div>
              </div>
            </div>

            {isIOS() && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md">
                <p className="text-sm text-blue-900 dark:text-blue-300 flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  You're on iOS! Follow the steps above to install.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Android Installation */}
        <Card data-testid="card-android-install">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SiAndroid className="h-6 w-6" />
                <CardTitle>Android</CardTitle>
              </div>
              <Badge variant="outline" data-testid="badge-android">Chrome/Edge</Badge>
            </div>
            <CardDescription>Install from Chrome or Edge browser</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  1
                </div>
                <div>
                  <p className="font-medium">Open in Chrome/Edge</p>
                  <p className="text-sm text-muted-foreground">
                    Use Chrome, Edge, or Samsung Internet browser
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  2
                </div>
                <div>
                  <p className="font-medium">Look for Install Banner</p>
                  <p className="text-sm text-muted-foreground">
                    A banner will appear at the bottom asking to install
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  3
                </div>
                <div>
                  <p className="font-medium">Tap "Install" or "Add"</p>
                  <p className="text-sm text-muted-foreground">
                    Confirm the installation when prompted
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  4
                </div>
                <div>
                  <p className="font-medium">Alternative: Menu Method</p>
                  <p className="text-sm text-muted-foreground">
                    Tap ⋮ menu → "Install app" or "Add to Home screen"
                  </p>
                </div>
              </div>
            </div>

            {isAndroid() && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md">
                <p className="text-sm text-green-900 dark:text-green-300 flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  You're on Android! Look for the install banner below.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Desktop Installation */}
        <Card data-testid="card-desktop-install">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Chrome className="h-6 w-6" />
                <CardTitle>Desktop (Windows/Mac/Linux)</CardTitle>
              </div>
              <Badge variant="outline" data-testid="badge-desktop">Chrome/Edge</Badge>
            </div>
            <CardDescription>Install as a desktop app</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  1
                </div>
                <div>
                  <p className="font-medium">Open in Chrome/Edge</p>
                  <p className="text-sm text-muted-foreground">
                    Use Chrome or Edge browser on your computer
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  2
                </div>
                <div>
                  <p className="font-medium">Look for Install Icon</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    Click the <AppWindow className="h-4 w-4 inline" /> install icon in the address bar
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  3
                </div>
                <div>
                  <p className="font-medium">Click "Install"</p>
                  <p className="text-sm text-muted-foreground">
                    Confirm installation when the popup appears
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  4
                </div>
                <div>
                  <p className="font-medium">Alternative: Menu Method</p>
                  <p className="text-sm text-muted-foreground">
                    Click ⋮ menu → "Install Accute..." or "Add to desktop"
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Benefits */}
        <Card data-testid="card-benefits">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <CardTitle>Why Install?</CardTitle>
            </div>
            <CardDescription>Benefits of the installed app</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Works Offline</p>
                  <p className="text-sm text-muted-foreground">Access your data even without internet</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Faster Performance</p>
                  <p className="text-sm text-muted-foreground">Lightning-fast loading and smooth interactions</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Native App Feel</p>
                  <p className="text-sm text-muted-foreground">Full screen, no browser UI distractions</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Easy Access</p>
                  <p className="text-sm text-muted-foreground">Launch from home screen like any other app</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Push Notifications</p>
                  <p className="text-sm text-muted-foreground">Get notified about important updates</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Auto Updates</p>
                  <p className="text-sm text-muted-foreground">Always get the latest features automatically</p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* QR Code Section (for desktop users) */}
      {!isMobile && !isTablet && (
        <Card className="mt-6" data-testid="card-qr-code">
          <CardHeader>
            <div className="flex items-center gap-2">
              <QrCode className="h-6 w-6" />
              <CardTitle>Install on Mobile Device</CardTitle>
            </div>
            <CardDescription>Scan QR code with your phone to open this page</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
              <div className="text-center">
                <QrCode className="h-16 w-16 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  QR Code would appear here
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Or copy this URL to your mobile device
                </p>
              </div>
            </div>
            <div className="mt-4 w-full max-w-md">
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={window.location.origin}
                  className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted"
                  data-testid="input-app-url"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.origin);
                  }}
                  data-testid="button-copy-url"
                >
                  Copy
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

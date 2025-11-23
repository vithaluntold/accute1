import { Link } from "wouter";
import finaceverseLogoUrl from "@assets/FinACEverse Transparent symbol_1763876301002.png";

interface FinACEverseBrandingProps {
  className?: string;
}

export function FinACEverseBranding({ className = "" }: FinACEverseBrandingProps) {
  return (
    <div className={`py-8 ${className}`} data-testid="section-finaceverse-branding">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm text-muted-foreground">
        <p data-testid="text-copyright" className="whitespace-nowrap">&copy; 2025 Accute. All rights reserved.</p>
        
        <p className="flex items-center gap-1.5 whitespace-nowrap">
          <span data-testid="text-powered-by">Powered by</span>
          <img 
            src={finaceverseLogoUrl} 
            alt="FinACEverse" 
            className="inline-block h-4 w-4"
            data-testid="img-finaceverse-logo"
          />
          <span data-testid="text-finaceverse">FinACEverse</span>
        </p>
        
        <div className="flex gap-6 whitespace-nowrap">
          <Link href="/privacy" className="hover-elevate" data-testid="link-footer-privacy">Privacy Policy</Link>
          <Link href="/terms" className="hover-elevate" data-testid="link-footer-terms">Terms of Service</Link>
        </div>
      </div>
    </div>
  );
}

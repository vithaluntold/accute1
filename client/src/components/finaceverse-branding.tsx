import { Link } from "wouter";
import finaceverseLogoUrl from "@assets/FinACEverse Transparent symbol_1763876301002.png";

interface FinACEverseBrandingProps {
  className?: string;
}

export function FinACEverseBranding({ className = "" }: FinACEverseBrandingProps) {
  return (
    <div className={`py-8 ${className}`} data-testid="section-finaceverse-branding">
      <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap mb-6">
        <span data-testid="text-powered-by">Powered by</span>
        <img 
          src={finaceverseLogoUrl} 
          alt="FinACEverse" 
          className="inline-block h-4 w-4"
          data-testid="img-finaceverse-logo"
        />
        <span data-testid="text-finaceverse">FinACEverse</span>
      </p>
      
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
        <p data-testid="text-copyright">&copy; 2025 Accute. All rights reserved.</p>
        <div className="flex gap-6">
          <Link href="/privacy" className="hover-elevate" data-testid="link-footer-privacy">Privacy Policy</Link>
          <Link href="/terms" className="hover-elevate" data-testid="link-footer-terms">Terms of Service</Link>
        </div>
      </div>
    </div>
  );
}

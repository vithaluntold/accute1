import finaceverseLogoUrl from "@assets/FinACEverse Transparent symbol_1763876301002.png";

interface FinACEverseBrandingProps {
  className?: string;
}

export function FinACEverseBranding({ className = "" }: FinACEverseBrandingProps) {
  return (
    <div 
      className={`border-t mt-12 pt-8 flex justify-center ${className}`}
      data-testid="section-finaceverse-branding"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span data-testid="text-powered-by">Powered by</span>
        <img 
          src={finaceverseLogoUrl} 
          alt="FinACEverse Logo" 
          className="h-6 w-6"
          data-testid="img-finaceverse-logo"
        />
        <span className="font-semibold" data-testid="text-finaceverse">FinACEverse</span>
      </div>
    </div>
  );
}

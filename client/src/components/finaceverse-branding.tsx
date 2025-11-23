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
      <div className="flex flex-col items-center gap-3">
        <img 
          src={finaceverseLogoUrl} 
          alt="FinACEverse Logo" 
          className="h-12 w-12"
          data-testid="img-finaceverse-logo"
        />
        <p 
          className="text-sm font-semibold text-muted-foreground"
          data-testid="text-powered-by"
        >
          POWERED BY FINACEVERSE
        </p>
      </div>
    </div>
  );
}

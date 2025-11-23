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
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap">
        <span data-testid="text-powered-by">Powered by</span>
        <img 
          src={finaceverseLogoUrl} 
          alt="FinACEverse" 
          className="inline-block h-4 w-4"
          data-testid="img-finaceverse-logo"
        />
        <span data-testid="text-finaceverse">FinACEverse</span>
      </p>
    </div>
  );
}

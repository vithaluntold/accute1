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
      <div className="inline-flex items-baseline gap-2 whitespace-nowrap text-sm text-muted-foreground">
        <span data-testid="text-powered-by">Powered by</span>
        <img 
          src={finaceverseLogoUrl} 
          alt="FinACEverse Logo" 
          className="h-5 w-5 align-middle"
          data-testid="img-finaceverse-logo"
        />
        <span className="font-semibold" data-testid="text-finaceverse">FinACEverse</span>
      </div>
    </div>
  );
}

import logoUrl from "@assets/FinACEverse Transparent symbol (1)_1761717040611.png";

export function FinACEverseFooter() {
  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 transform" data-testid="finaceverse-footer">
      <div className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover-elevate">
        <span className="text-sm font-medium text-muted-foreground">Powered by</span>
        <div className="flex items-center gap-2">
          <div className="relative h-5 w-5 flex-shrink-0">
            <img
              src={logoUrl}
              alt="FinACEverse Logo"
              className="rounded-sm object-contain w-full h-full"
            />
          </div>
          <span className="text-sm font-semibold tracking-wide bg-gradient-to-r from-[#e5a660] to-[#d76082] bg-clip-text text-transparent">
            FinACEverse
          </span>
        </div>
      </div>
    </div>
  );
}

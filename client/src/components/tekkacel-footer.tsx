import logoUrl from "@assets/logo (1)_1763536830004.png";

export function TekkacelFooter() {
  return (
    <div 
      className="fixed z-50 left-1/2 -translate-x-1/2 bottom-4 sm:bottom-6" 
      style={{
        bottom: 'calc(16px + env(safe-area-inset-bottom))',
      }}
      data-testid="tekkacel-footer"
    >
      <div className="flex items-center gap-2 sm:gap-2.5 rounded-lg sm:rounded-xl border border-border/50 bg-card/95 px-3 py-2 sm:px-4 sm:py-2.5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover-elevate">
        <span className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap">Powered by</span>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="relative h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0">
            <img
              src={logoUrl}
              alt="Tekkacel Logo"
              className="rounded-sm object-contain w-full h-full"
              draggable={false}
            />
          </div>
          <span className="text-xs sm:text-sm font-semibold tracking-wide bg-gradient-to-r from-[#4A9FD8] to-[#2B7EC0] bg-clip-text text-transparent whitespace-nowrap">
            Tekkacel
          </span>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, useRef } from "react";

interface Logo {
  name: string;
  color?: string;
}

interface LogoCarouselProps {
  logos?: Logo[];
  speed?: number;
}

const defaultLogos: Logo[] = [
  { name: "QuickBooks", color: "#2CA01C" },
  { name: "Xero", color: "#13B5EA" },
  { name: "Intuit", color: "#365EBF" },
  { name: "Microsoft", color: "#00A4EF" },
  { name: "Google", color: "#4285F4" },
  { name: "Razorpay", color: "#528FF0" },
  { name: "OpenAI", color: "#10A37F" },
  { name: "Azure", color: "#0089D6" },
  { name: "Anthropic", color: "#D4A574" },
  { name: "Stripe", color: "#635BFF" },
];

function LogoItem({ logo, index }: { logo: Logo; index: number }) {
  return (
    <div 
      className="flex-shrink-0 px-8 py-4 flex items-center justify-center"
      data-testid={`logo-${logo.name.toLowerCase()}-${index}`}
    >
      <div 
        className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity duration-300 grayscale hover:grayscale-0"
      >
        <div 
          className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
          style={{ backgroundColor: logo.color || '#666' }}
        >
          {logo.name.charAt(0)}
        </div>
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
          {logo.name}
        </span>
      </div>
    </div>
  );
}

export function LogoCarousel({ logos = defaultLogos, speed = 30 }: LogoCarouselProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (trackRef.current) {
      const firstTrack = trackRef.current.querySelector('[data-track="first"]');
      if (firstTrack) {
        setTrackWidth(firstTrack.scrollWidth);
      }
    }
  }, [logos]);
  
  const animationDuration = trackWidth > 0 ? trackWidth / speed : 20;
  
  return (
    <div className="relative overflow-hidden py-8" data-testid="logo-carousel">
      <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
      
      <div 
        ref={trackRef}
        className="flex animate-marquee"
        style={{
          animationDuration: `${animationDuration}s`,
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
        }}
      >
        <div className="flex flex-shrink-0" data-track="first">
          {logos.map((logo, index) => (
            <LogoItem key={`first-${logo.name}-${index}`} logo={logo} index={index} />
          ))}
        </div>
        <div className="flex flex-shrink-0" data-track="second">
          {logos.map((logo, index) => (
            <LogoItem key={`second-${logo.name}-${index}`} logo={logo} index={index + logos.length} />
          ))}
        </div>
      </div>
      
      <style>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          animation-name: marquee;
        }
      `}</style>
    </div>
  );
}

export function TrustedBySection() {
  return (
    <section className="py-12 border-y bg-muted/20" data-testid="trusted-by-section">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Trusted by forward-thinking accounting firms
          </p>
        </div>
        <LogoCarousel />
      </div>
    </section>
  );
}

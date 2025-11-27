import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  company: string;
  metric?: string;
  initials?: string;
}

interface TestimonialCarouselProps {
  testimonials?: Testimonial[];
  autoRotate?: boolean;
  interval?: number;
}

const defaultTestimonials: Testimonial[] = [
  {
    quote: "Accute transformed how we manage our tax practice. The AI agents handle 80% of our routine inquiries, and our team now focuses on what matters most - advisory services.",
    author: "Sarah Mitchell",
    role: "Managing Partner",
    company: "Mitchell & Associates CPAs",
    metric: "80% routine work automated",
    initials: "SM"
  },
  {
    quote: "The document management with PKI signatures is a game-changer. We've eliminated paper entirely, and clients love the secure portal. Engagement letters take minutes, not hours.",
    author: "David Chen",
    role: "Senior Partner",
    company: "Chen Tax Advisory",
    metric: "95% faster document turnaround",
    initials: "DC"
  },
  {
    quote: "We scaled from 200 to 500 clients without adding staff. The workflow automation handles onboarding, organizer distribution, and follow-ups automatically.",
    author: "Rachel Thompson",
    role: "Founder",
    company: "Thompson Bookkeeping",
    metric: "2.5x client growth",
    initials: "RT"
  },
  {
    quote: "The AI Psychology Assessment helped us understand our team dynamics. We're now 40% more efficient in task assignment, and employee satisfaction has never been higher.",
    author: "Michael Rodriguez",
    role: "Operations Director",
    company: "Rodriguez & Partners",
    metric: "40% efficiency improvement",
    initials: "MR"
  },
  {
    quote: "Implementing Accute was smooth and the results were immediate. Our productivity soared and we're now leading our market in client satisfaction.",
    author: "Jennifer Park",
    role: "Principal",
    company: "Park Financial Services",
    metric: "30% productivity increase",
    initials: "JP"
  }
];

export function TestimonialCarousel({ 
  testimonials = defaultTestimonials, 
  autoRotate = true, 
  interval = 5000 
}: TestimonialCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  useEffect(() => {
    if (!autoRotate || isPaused) return;
    
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, interval);
    
    return () => clearInterval(timer);
  }, [autoRotate, interval, isPaused, testimonials.length]);
  
  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };
  
  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };
  
  const currentTestimonial = testimonials[currentIndex];
  
  return (
    <div 
      className="relative max-w-4xl mx-auto"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      data-testid="testimonial-carousel"
    >
      <Card className="bg-card/50 backdrop-blur-sm border-white/10 overflow-hidden">
        <CardContent className="p-8 md:p-12">
          <div className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#e5a660]/20 to-[#d76082]/20 flex items-center justify-center mb-6">
              <Quote className="h-6 w-6 text-[#e5a660]" />
            </div>
            
            <blockquote className="text-lg md:text-xl text-foreground/90 leading-relaxed mb-8 max-w-3xl">
              "{currentTestimonial.quote}"
            </blockquote>
            
            {currentTestimonial.metric && (
              <div className="mb-6">
                <span className="inline-block px-4 py-2 rounded-full bg-gradient-to-r from-[#e5a660]/10 to-[#d76082]/10 border border-[#e5a660]/20 text-sm font-medium">
                  <span className="bg-gradient-to-r from-[#e5a660] to-[#d76082] bg-clip-text text-transparent">
                    {currentTestimonial.metric}
                  </span>
                </span>
              </div>
            )}
            
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-[#e5a660]/30">
                <AvatarFallback className="bg-gradient-to-br from-[#e5a660] to-[#d76082] text-white font-semibold">
                  {currentTestimonial.initials || currentTestimonial.author.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="text-left">
                <div className="font-semibold text-foreground">{currentTestimonial.author}</div>
                <div className="text-sm text-muted-foreground">{currentTestimonial.role}</div>
                <div className="text-sm text-[#e5a660]">{currentTestimonial.company}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="flex items-center justify-center gap-4 mt-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPrevious}
          className="h-10 w-10 rounded-full border border-white/10 hover:bg-white/5"
          data-testid="testimonial-prev"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        
        <div className="flex gap-2">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? 'w-8 bg-gradient-to-r from-[#e5a660] to-[#d76082]' 
                  : 'w-2 bg-white/20 hover:bg-white/40'
              }`}
              data-testid={`testimonial-dot-${index}`}
            />
          ))}
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={goToNext}
          className="h-10 w-10 rounded-full border border-white/10 hover:bg-white/5"
          data-testid="testimonial-next"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

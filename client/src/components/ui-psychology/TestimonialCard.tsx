import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Testimonial {
  quote: string;
  author: string;
  role: string;
  company: string;
  avatar?: string;
  rating?: number;
  verified?: boolean;
}

interface TestimonialCardProps {
  testimonial: Testimonial;
  className?: string;
  compact?: boolean;
}

export function TestimonialCard({ testimonial, className, compact = false }: TestimonialCardProps) {
  const initials = testimonial.author
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card
      className={cn("relative overflow-hidden", className)}
      data-testid="card-testimonial"
    >
      <CardContent className={cn("pt-6", compact ? "pb-4" : "pb-6")}>
        <div className="flex flex-col gap-4">
          {/* Rating */}
          {testimonial.rating && (
            <div className="flex items-center gap-1" data-testid="testimonial-rating">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "h-4 w-4",
                    i < testimonial.rating!
                      ? "fill-amber-400 text-amber-400"
                      : "fill-muted text-muted"
                  )}
                />
              ))}
            </div>
          )}

          {/* Quote */}
          <div className="relative">
            <Quote className="absolute -top-2 -left-1 h-6 w-6 text-muted-foreground/20" />
            <blockquote
              className={cn(
                "pl-6 text-sm leading-relaxed",
                compact ? "line-clamp-3" : ""
              )}
              data-testid="testimonial-quote"
            >
              {testimonial.quote}
            </blockquote>
          </div>

          {/* Author */}
          <div className="flex items-center gap-3 pt-2">
            <Avatar className="h-10 w-10">
              {testimonial.avatar && <AvatarImage src={testimonial.avatar} alt={testimonial.author} />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate" data-testid="testimonial-author">
                  {testimonial.author}
                </p>
                {testimonial.verified && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    Verified
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate" data-testid="testimonial-role">
                {testimonial.role} at {testimonial.company}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Pre-configured testimonials for quick integration
export const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    quote: "Accute's AI agents have transformed how we handle tax season. What used to take our team 3 weeks now takes 4 days. The automation is incredible.",
    author: "Sarah Mitchell",
    role: "Managing Partner",
    company: "Mitchell & Associates CPA",
    rating: 5,
    verified: true,
  },
  {
    quote: "The workflow automation alone saved us 40 hours per month. Our clients love the transparency and real-time updates. Best investment we've made.",
    author: "James Chen",
    role: "Senior Accountant",
    company: "Chen Financial Services",
    rating: 5,
    verified: true,
  },
  {
    quote: "We were skeptical about AI in accounting, but Accute proved us wrong. The compliance features give us peace of mind, and our efficiency has tripled.",
    author: "Maria Rodriguez",
    role: "Tax Director",
    company: "Rodriguez Tax Group",
    rating: 5,
    verified: true,
  },
  {
    quote: "Incredible platform. The AI agents handle repetitive tasks flawlessly, freeing up our team to focus on high-value client advisory work.",
    author: "David Park",
    role: "Founder & CPA",
    company: "Park Accounting Solutions",
    rating: 5,
    verified: true,
  },
];

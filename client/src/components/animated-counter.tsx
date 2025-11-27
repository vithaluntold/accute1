import { useEffect, useState, useRef } from "react";
import { Clock, Brain, Shield, Sparkles, Users, Zap, type LucideIcon } from "lucide-react";

interface CounterStat {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
  icon: LucideIcon;
}

interface AnimatedCounterProps {
  stats?: CounterStat[];
}

function useCountUp(end: number, duration: number = 2000, start: boolean = false) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    if (!start) return;
    
    let startTime: number;
    let animationFrame: number;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOut * end));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [end, duration, start]);
  
  return count;
}

function CounterItem({ stat, isVisible }: { stat: CounterStat; isVisible: boolean }) {
  const count = useCountUp(stat.value, 2000, isVisible);
  const Icon = stat.icon;
  
  return (
    <div className="text-center p-6 group" data-testid={`counter-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-[#e5a660]/20 to-[#d76082]/20 flex items-center justify-center mb-4 group-hover:from-[#e5a660]/30 group-hover:to-[#d76082]/30 transition-all duration-300">
        <Icon className="h-8 w-8 text-[#e5a660]" />
      </div>
      <div className="text-4xl md:text-5xl font-display font-bold bg-gradient-to-r from-[#e5a660] to-[#d76082] bg-clip-text text-transparent">
        {stat.prefix}{count}{stat.suffix}
      </div>
      <div className="text-sm text-muted-foreground mt-2 font-medium">{stat.label}</div>
    </div>
  );
}

export function AnimatedCounter({ stats }: AnimatedCounterProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  const defaultStats: CounterStat[] = [
    { value: 15, suffix: "+", label: "Hours Saved Weekly", icon: Clock },
    { value: 12, suffix: "", label: "AI Agents", icon: Brain },
    { value: 500, suffix: "+", label: "Active Users", icon: Users },
    { value: 21, suffix: "", label: "Day Free Trial", icon: Sparkles },
  ];
  
  const displayStats = stats || defaultStats;
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    
    if (ref.current) {
      observer.observe(ref.current);
    }
    
    return () => observer.disconnect();
  }, []);
  
  return (
    <div ref={ref} className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {displayStats.map((stat, index) => (
        <CounterItem key={index} stat={stat} isVisible={isVisible} />
      ))}
    </div>
  );
}

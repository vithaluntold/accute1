import { useEffect, useState } from "react";

interface AIVisualAnimationProps {
  variant?: "hero" | "sidebar" | "small";
  className?: string;
}

export function AIVisualAnimation({ variant = "hero", className = "" }: AIVisualAnimationProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sizes = {
    hero: "w-[400px] h-[400px] md:w-[500px] md:h-[500px]",
    sidebar: "w-[300px] h-[300px]",
    small: "w-[200px] h-[200px]",
  };

  if (!mounted) return null;

  return (
    <div className={`relative ${sizes[variant]} ${className}`} data-testid="ai-visual-animation">
      <svg
        viewBox="0 0 400 400"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="neuralGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e5a660" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#d76082" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#e5a660" stopOpacity="0.8" />
          </linearGradient>
          
          <linearGradient id="coreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e5a660" />
            <stop offset="100%" stopColor="#d76082" />
          </linearGradient>

          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="softGlow">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="animate-spin-slow" style={{ transformOrigin: "200px 200px" }}>
          <circle
            cx="200"
            cy="200"
            r="150"
            fill="none"
            stroke="url(#neuralGradient)"
            strokeWidth="1"
            strokeDasharray="10 5"
            opacity="0.5"
          />
        </g>

        <g className="animate-spin-reverse" style={{ transformOrigin: "200px 200px" }}>
          <circle
            cx="200"
            cy="200"
            r="120"
            fill="none"
            stroke="url(#neuralGradient)"
            strokeWidth="1.5"
            strokeDasharray="20 10"
            opacity="0.6"
          />
        </g>

        <g className="animate-spin-slow" style={{ transformOrigin: "200px 200px", animationDuration: "25s" }}>
          <circle
            cx="200"
            cy="200"
            r="90"
            fill="none"
            stroke="url(#neuralGradient)"
            strokeWidth="2"
            strokeDasharray="15 8"
            opacity="0.7"
          />
        </g>

        {[0, 60, 120, 180, 240, 300].map((angle, i) => (
          <g key={i} className="animate-pulse-node" style={{ animationDelay: `${i * 0.3}s` }}>
            <circle
              cx={200 + 150 * Math.cos((angle * Math.PI) / 180)}
              cy={200 + 150 * Math.sin((angle * Math.PI) / 180)}
              r="8"
              fill="url(#coreGradient)"
              filter="url(#glow)"
            />
            <line
              x1={200 + 150 * Math.cos((angle * Math.PI) / 180)}
              y1={200 + 150 * Math.sin((angle * Math.PI) / 180)}
              x2="200"
              y2="200"
              stroke="url(#neuralGradient)"
              strokeWidth="1"
              opacity="0.4"
              className="animate-line-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          </g>
        ))}

        {[30, 90, 150, 210, 270, 330].map((angle, i) => (
          <g key={`inner-${i}`} className="animate-pulse-node" style={{ animationDelay: `${i * 0.25}s` }}>
            <circle
              cx={200 + 90 * Math.cos((angle * Math.PI) / 180)}
              cy={200 + 90 * Math.sin((angle * Math.PI) / 180)}
              r="6"
              fill="url(#coreGradient)"
              filter="url(#glow)"
              opacity="0.8"
            />
            <line
              x1={200 + 90 * Math.cos((angle * Math.PI) / 180)}
              y1={200 + 90 * Math.sin((angle * Math.PI) / 180)}
              x2="200"
              y2="200"
              stroke="url(#neuralGradient)"
              strokeWidth="0.8"
              opacity="0.3"
            />
          </g>
        ))}

        <g filter="url(#softGlow)">
          <circle
            cx="200"
            cy="200"
            r="40"
            fill="url(#coreGradient)"
            className="animate-core-pulse"
          />
          <circle
            cx="200"
            cy="200"
            r="50"
            fill="none"
            stroke="url(#coreGradient)"
            strokeWidth="2"
            opacity="0.5"
            className="animate-ring-expand"
          />
          <circle
            cx="200"
            cy="200"
            r="55"
            fill="none"
            stroke="url(#coreGradient)"
            strokeWidth="1"
            opacity="0.3"
            className="animate-ring-expand"
            style={{ animationDelay: "0.5s" }}
          />
        </g>

        <g className="animate-data-flow">
          {[0, 72, 144, 216, 288].map((angle, i) => (
            <circle
              key={`data-${i}`}
              cx={200 + 70 * Math.cos((angle * Math.PI) / 180)}
              cy={200 + 70 * Math.sin((angle * Math.PI) / 180)}
              r="3"
              fill="#fff"
              opacity="0.8"
              className="animate-orbit-particle"
              style={{ 
                animationDelay: `${i * 0.4}s`,
                transformOrigin: "200px 200px"
              }}
            />
          ))}
        </g>

        <text
          x="200"
          y="205"
          textAnchor="middle"
          fill="white"
          fontSize="24"
          fontFamily="Orbitron, sans-serif"
          fontWeight="bold"
          className="animate-text-glow"
        >
          AI
        </text>
      </svg>

      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => {
          // Deterministic pseudo-random positions based on index
          const seed1 = ((i * 7919) % 100) / 100;
          const seed2 = ((i * 6271) % 100) / 100;
          const seed3 = ((i * 5113) % 100) / 100;
          return (
            <div
              key={i}
              className="absolute w-1 h-1 bg-[#e5a660] rounded-full animate-float-particle"
              style={{
                left: `${seed1 * 100}%`,
                top: `${seed2 * 100}%`,
                animationDelay: `${seed1 * 5}s`,
                animationDuration: `${3 + seed2 * 4}s`,
                opacity: 0.3 + seed3 * 0.4,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function NeuralNetworkBackground({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e5a660" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#d76082" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#e5a660" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        
        <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
          <path
            d="M 50 0 L 0 0 0 50"
            fill="none"
            stroke="url(#bgGradient)"
            strokeWidth="0.5"
            opacity="0.3"
          />
        </pattern>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {[...Array(15)].map((_, i) => (
          <circle
            key={i}
            cx={`${10 + (i * 6)}%`}
            cy={`${20 + Math.sin(i) * 30}%`}
            r="3"
            fill="#e5a660"
            opacity="0.2"
            className="animate-pulse-node"
            style={{ animationDelay: `${i * 0.3}s` }}
          />
        ))}

        {[...Array(10)].map((_, i) => (
          <line
            key={`line-${i}`}
            x1={`${5 + (i * 10)}%`}
            y1={`${30 + Math.cos(i) * 20}%`}
            x2={`${15 + (i * 10)}%`}
            y2={`${40 + Math.sin(i) * 25}%`}
            stroke="#d76082"
            strokeWidth="0.5"
            opacity="0.15"
            className="animate-line-pulse"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </svg>
    </div>
  );
}

export function FloatingParticles({ count = 30, className = "" }: { count?: number; className?: string }) {
  // Use deterministic positions based on index to avoid hydration mismatch
  const particles = [...Array(count)].map((_, i) => {
    // Pseudo-random but deterministic values based on index
    const seed1 = ((i * 7919) % 100) / 100; // Prime number for distribution
    const seed2 = ((i * 6271) % 100) / 100;
    const seed3 = ((i * 5113) % 100) / 100;
    
    return {
      size: 2 + seed1 * 4,
      left: seed2 * 100,
      top: seed3 * 100,
      delay: (i * 0.3) % 8,
      duration: 5 + seed1 * 10,
      opacity: 0.2 + seed2 * 0.4,
    };
  });

  return (
    <div 
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      data-testid="floating-particles-container"
    >
      {particles.map((particle, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-float-particle"
          data-testid={`floating-particle-${i}`}
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            background: i % 2 === 0 ? "#e5a660" : "#d76082",
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
            opacity: particle.opacity,
          }}
        />
      ))}
    </div>
  );
}

export function RobotAvatar({ size = 120, className = "" }: { size?: number; className?: string }) {
  return (
    <div 
      className={`relative ${className}`} 
      style={{ width: size, height: size }}
      data-testid="robot-avatar"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <defs>
          <linearGradient id="robotGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e5a660" />
            <stop offset="100%" stopColor="#d76082" />
          </linearGradient>
          <filter id="robotGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect
          x="25"
          y="20"
          width="50"
          height="55"
          rx="8"
          fill="url(#robotGradient)"
          filter="url(#robotGlow)"
        />

        <rect x="15" y="35" width="10" height="25" rx="3" fill="url(#robotGradient)" opacity="0.8" />
        <rect x="75" y="35" width="10" height="25" rx="3" fill="url(#robotGradient)" opacity="0.8" />

        <circle cx="40" cy="40" r="8" fill="#fff" />
        <circle cx="60" cy="40" r="8" fill="#fff" />
        
        <circle cx="40" cy="40" r="4" fill="#1a1a2e" className="animate-eye-blink" />
        <circle cx="60" cy="40" r="4" fill="#1a1a2e" className="animate-eye-blink" />

        <circle cx="40" cy="39" r="1.5" fill="#fff" opacity="0.8" />
        <circle cx="60" cy="39" r="1.5" fill="#fff" opacity="0.8" />

        <rect x="35" y="55" width="30" height="3" rx="1.5" fill="#fff" opacity="0.9" />
        <rect x="38" y="60" width="24" height="2" rx="1" fill="#fff" opacity="0.6" />

        <rect x="45" y="8" width="10" height="15" rx="3" fill="url(#robotGradient)" opacity="0.9" />
        <circle cx="50" cy="5" r="4" fill="url(#robotGradient)" className="animate-antenna-pulse" />

        <circle cx="50" cy="48" r="3" fill="#fff" className="animate-core-pulse" opacity="0.6" />
      </svg>

      <div className="absolute inset-0">
        {[...Array(6)].map((_, i) => {
          // Deterministic positions for sparks around robot
          const seed1 = ((i * 7919) % 40) / 100; // 0-0.4 range
          const seed2 = ((i * 6271) % 60) / 100; // 0-0.6 range
          return (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-spark"
              style={{
                left: `${30 + seed1 * 100}%`,
                top: `${20 + seed2 * 100}%`,
                animationDelay: `${i * 0.5}s`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

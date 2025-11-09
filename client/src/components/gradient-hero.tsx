import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface GradientHeroProps {
  icon: LucideIcon;
  title: ReactNode;
  description: string;
  actions?: ReactNode;
  testId?: string;
  titleText?: string;
}

export function GradientHero({
  icon: Icon,
  title,
  description,
  actions,
  testId = "gradient-hero",
  titleText,
}: GradientHeroProps) {
  const ariaLabel = titleText 
    ? `${titleText} page header`
    : typeof title === 'string' 
      ? `${title} page header`
      : undefined;
  
  return (
    <header
      className="relative mb-8"
      role="banner"
      aria-label={ariaLabel}
      data-testid={testId}
    >
      <div className="absolute inset-0 gradient-hero" aria-hidden="true"></div>
      <div className="relative container mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="max-w-4xl flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-7 w-7 text-white" aria-hidden="true" />
              <h1
                className="text-2xl md:text-3xl font-display font-bold text-white"
                data-testid={`${testId}-title`}
              >
                {title}
              </h1>
            </div>
            <p
              className="text-white/90 text-sm md:text-base"
              data-testid={`${testId}-description`}
            >
              {description}
            </p>
          </div>
          {actions && (
            <div className="flex items-center gap-2" data-testid={`${testId}-actions`}>
              {actions}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

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
      <div className="relative container mx-auto p-6 md:p-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="max-w-4xl flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Icon className="h-10 w-10 text-white" aria-hidden="true" />
              <h1
                className="text-4xl md:text-5xl font-display font-bold text-white"
                data-testid={`${testId}-title`}
              >
                {title}
              </h1>
            </div>
            <p
              className="text-white/90 text-lg"
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

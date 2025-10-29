import { Home, Briefcase, Bot, BarChart3, User } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Home", path: "/dashboard", testId: "nav-home" },
  { icon: Briefcase, label: "Workflows", path: "/workflows", testId: "nav-workflows" },
  { icon: Bot, label: "AI Agents", path: "/ai-agents", testId: "nav-ai-agents" },
  { icon: BarChart3, label: "Analytics", path: "/analytics", testId: "nav-analytics" },
  { icon: User, label: "Settings", path: "/settings", testId: "nav-settings" },
];

export function MobileBottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background border-t border-border">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map(({ icon: Icon, label, path, testId }) => {
          const isActive = location === path || 
            (path !== "/dashboard" && location.startsWith(path));

          return (
            <Link key={path} href={path}>
              <a
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-md transition-colors",
                  "min-w-[64px] hover-elevate active-elevate-2",
                  isActive && "text-primary bg-primary/10"
                )}
                data-testid={testId}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{label}</span>
              </a>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

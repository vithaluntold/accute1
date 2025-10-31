import { ReactNode } from "react";
import { Redirect } from "wouter";
import { getUser } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: string[];
  fallbackPath?: string;
}

function getRoleAwareHomePath(role: string): string {
  switch (role) {
    case "Super Admin":
      return "/admin/dashboard";
    case "Client":
      return "/client-portal/dashboard";
    case "Admin":
    case "Employee":
    default:
      return "/dashboard";
  }
}

export function RoleGuard({ children, allowedRoles, fallbackPath }: RoleGuardProps) {
  const user = getUser();
  const [, setLocation] = useLocation();

  if (!user) {
    return <Redirect to="/login" />;
  }

  const userRole = user.roleName || user.role;
  const hasAccess = allowedRoles.includes(userRole);

  if (!hasAccess) {
    // Compute role-aware fallback destination
    const roleAwareFallback = fallbackPath || getRoleAwareHomePath(userRole);
    
    // If fallback path is provided or computed, redirect there
    if (roleAwareFallback) {
      return <Redirect to={roleAwareFallback} />;
    }

    // Otherwise show access denied message (should rarely happen with smart fallback)
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Card className="max-w-md w-full" data-testid="card-access-denied">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-full bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <CardTitle>Access Denied</CardTitle>
                <CardDescription>
                  You don't have permission to access this page
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This page is restricted to users with the following roles:
            </p>
            <div className="flex flex-wrap gap-2">
              {allowedRoles.map((role) => (
                <span
                  key={role}
                  className="px-3 py-1 rounded-md bg-muted text-sm font-medium"
                  data-testid={`badge-required-role-${role}`}
                >
                  {role}
                </span>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Your current role is: <span className="font-semibold">{userRole}</span>
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => setLocation(getRoleAwareHomePath(userRole))}
                data-testid="button-go-dashboard"
              >
                Go to Home
              </Button>
              <Button
                variant="outline"
                onClick={() => window.history.back()}
                data-testid="button-go-back"
              >
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

import { ProtectedRoute } from "@/components/protected-route";
import { RoleGuard } from "@/components/role-guard";

export function OrganizationRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <RoleGuard allowedRoles={["Admin", "Employee", "Super Admin"]}>
        {children}
      </RoleGuard>
    </ProtectedRoute>
  );
}

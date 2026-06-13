import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, homeForRole, type Role } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export function RoleGuard({
  allow,
  children,
}: {
  allow: Role[];
  children: ReactNode;
}) {
  const { user, role, loading, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (profile && profile.is_active === false) {
      navigate({ to: "/login" });
      return;
    }
    if (role && !allow.includes(role)) {
      navigate({ to: homeForRole(role) });
    }
  }, [user, role, loading, profile, allow, navigate]);

  if (loading || !user || !role) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!allow.includes(role)) return null;

  return <AppShell role={role}>{children}</AppShell>;
}

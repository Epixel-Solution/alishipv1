import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";

export const Route = createFileRoute("/office/bags")({
  component: () => (
    <RoleGuard allow={["office", "super_admin"]}>
      <Outlet />
    </RoleGuard>
  ),
});
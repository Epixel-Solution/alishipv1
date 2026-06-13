import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";

// Reuse office routes for super admin via simple aliases.
// (These pages already check role internally and call office endpoints.)
export const Route = createFileRoute("/admin/bags")({
  component: () => (
    <RoleGuard allow={["super_admin"]}>
      <div className="text-sm text-muted-foreground">
        Use <a className="text-primary underline" href="/office/bags">Bags</a> — super admins have full access there.
      </div>
    </RoleGuard>
  ),
});

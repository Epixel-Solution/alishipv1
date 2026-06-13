import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/pending")({
  beforeLoad: () => {
    throw redirect({ to: "/office/pending" });
  },
});

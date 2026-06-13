import { createFileRoute } from "@tanstack/react-router";
import { Route as Office } from "./office.parcels.$id";
export const Route = createFileRoute("/admin/parcels/$id")({
  validateSearch: Office.options.validateSearch as any,
  component: Office.options.component as any,
});

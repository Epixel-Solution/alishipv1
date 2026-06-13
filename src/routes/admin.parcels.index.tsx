import { createFileRoute } from "@tanstack/react-router";
import { Route as Office } from "./office.parcels.index";
export const Route = createFileRoute("/admin/parcels/")({
  component: Office.options.component as any,
});

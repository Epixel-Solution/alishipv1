import { supabase } from "@/integrations/supabase/client";

async function callAdminFn(action: string, body?: object) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Unauthorized");

  const payload = { action, ...body };

  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: payload,
  });

  if (error) {
    // Try to get the actual message from the response body
    try {
      const json = await (error as any).context?.json?.();
      const msg = json?.error || error.message || "Request failed";
      throw new Error(msg);
    } catch (parseErr: any) {
      if (parseErr.message && parseErr.message !== "Request failed") throw parseErr;
      throw new Error(error.message || "Request failed");
    }
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function adminCreateUser(input: {
  email: string; password: string; full_name: string;
  phone?: string | null; role: "super_admin" | "office" | "rider";
}) {
  return callAdminFn("create", input);
}

export async function adminResetPassword(input: { user_id: string; new_password: string }) {
  return callAdminFn("reset-password", input);
}

export async function adminSetActive(input: { user_id: string; is_active: boolean }) {
  return callAdminFn("set-active", input);
}

export async function adminListUsers() {
  return callAdminFn("list");
}

export async function adminListRiders() {
  return callAdminFn("list-riders");
}

export async function adminAssignParcelDirect(input: { parcel_id: string; rider_id: string }) {
  const { data: { session } } = await supabase.auth.getSession();
  return callAdminFn("assign-parcel", { ...input, assigned_by: session?.user?.id });
}

export async function bootstrapSuperAdmin() {
  return { created: false, message: "Use Supabase dashboard to create super admin" };
}
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type Role = "super_admin" | "office" | "rider";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  staff_code: string | null;
  phone: string | null;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; role: Role | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  // Guard against double-fetch: track the uid currently being loaded
  const loadingUid = useRef<string | null>(null);

  const loadProfile = async (uid: string) => {
    // If already loading this uid, skip — prevents double-fetch from
    // onAuthStateChange + getSession firing simultaneously on app start
    if (loadingUid.current === uid) return;
    loadingUid.current = uid;
    try {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, is_active, staff_code, phone")
          .eq("id", uid)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid)
          .maybeSingle(),
      ]);
      setProfile((p as Profile) ?? null);
      setRole(((r as { role: Role } | null)?.role) ?? null);
    } catch (err) {
      console.error("loadProfile error:", err);
      setProfile(null);
      setRole(null);
    } finally {
      loadingUid.current = null;
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Get the current session immediately (synchronous cache hit on most devices)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadProfile(data.session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 2. Listen for future auth changes (sign in, sign out, token refresh)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadProfile(s.user.id);
      } else {
        setProfile(null);
        setRole(null);
        loadingUid.current = null;
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null; role: Role | null }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { error: error?.message ?? "Sign in failed", role: null };

    const { data: r } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();

    const userRole = (r as { role: Role } | null)?.role ?? null;
    return { error: null, role: userRole };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refresh = async () => {
    if (user) await loadProfile(user.id);
  };

  return (
    <Ctx.Provider value={{ user, session, profile, role, loading, signIn, signOut, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}

export function homeForRole(role: Role | null): string {
  if (role === "super_admin") return "/admin";
  if (role === "office") return "/office";
  if (role === "rider") return "/rider";
  return "/login";
}

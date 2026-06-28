import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, homeForRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { PublicShell } from "@/components/PublicShell";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && role) {
      navigate({ to: homeForRole(role), replace: true });
    }
  }, [user, role, loading, navigate]);

  // While auth is resolving OR user is already logged in — show nothing.
  // This prevents the login card from rendering on top of the dashboard.
  if (loading || (user && role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error, role: userRole } = await signIn(email.trim(), password);
    setSubmitting(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Signed in");
    navigate({ to: homeForRole(userRole), replace: true });
  };

  return (
    <PublicShell>
      <div className="flex min-h-[70vh] flex-col bg-muted/30">
        <main className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-md">
            <Card className="border-border/40 bg-card p-6 shadow-[var(--shadow-card)]">
              <h1 className="mb-1 text-2xl">Welcome back</h1>
              <p className="mb-6 text-sm text-muted-foreground">
                Sign in to continue to your dashboard.
              </p>
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@aliship.com"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
                <div className="text-center text-sm">
                  <Link to="/reset-password" className="text-primary hover:underline">
                    Forgot your password?
                  </Link>
                </div>
              </form>
            </Card>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Accounts are created by your Super Admin. Contact admin if you can't sign in.
            </p>
          </div>
        </main>
      </div>
    </PublicShell>
  );
}

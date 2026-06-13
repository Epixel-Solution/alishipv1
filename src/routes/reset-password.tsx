import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { PublicShell } from "@/components/PublicShell";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPage,
});

function ResetPage() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [mode, setMode] = useState<"request" | "update">(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      return "update";
    }
    return "request";
  });
  const [busy, setBusy] = useState(false);

  const onRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("If that email exists, a reset link was sent.");
  };

  const onUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Password updated. Please sign in.");
      setMode("request");
    }
  };

  return (
    <PublicShell>
      <div className="flex min-h-[80vh] flex-col bg-background">
        <main className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex justify-center">
              <Logo />
            </div>
            <Card className="border-border/60 bg-card/80 p-6">
              {mode === "request" ? (
                <>
                  <h1 className="mb-1 text-2xl">Reset password</h1>
                  <p className="mb-6 text-sm text-muted-foreground">
                    Enter your email and we'll send you a reset link.
                  </p>
                  <form onSubmit={onRequest} className="space-y-4">
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" required value={email}
                        onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <Button disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                      Send reset link
                    </Button>
                  </form>
                </>
              ) : (
                <>
                  <h1 className="mb-1 text-2xl">Set new password</h1>
                  <p className="mb-6 text-sm text-muted-foreground">Choose a strong new password.</p>
                  <form onSubmit={onUpdate} className="space-y-4">
                    <div>
                      <Label htmlFor="newPassword">New password</Label>
                      <Input id="newPassword" type="password" minLength={8} required
                        value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                    </div>
                    <Button disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                      Update password
                    </Button>
                  </form>
                </>
              )}
              <div className="mt-4 text-center text-sm">
                <Link to="/login" className="text-primary hover:underline">
                  Back to sign in
                </Link>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </PublicShell>
  );
}
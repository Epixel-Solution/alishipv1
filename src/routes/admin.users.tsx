import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { useEffect, useState, useCallback } from "react";
import { adminCreateUser, adminListUsers, adminResetPassword, adminSetActive } from "@/fns/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, KeyRound, Power, Share2 } from "lucide-react";
import { CredentialsDialog } from "@/components/CredentialsDialog";
import type { Credentials } from "@/lib/credentials";

export const Route = createFileRoute("/admin/users")({
  component: () => (
    <RoleGuard allow={["super_admin"]}>
      <Users />
    </RoleGuard>
  ),
});

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  office: "Admin",
  rider: "Rider",
};

function generateTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  const rand = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pw = rand(upper) + rand(lower) + rand(digits) + rand(digits);
  for (let i = 0; i < 6; i++) pw += rand(all);
  return pw;
}

function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [resetUser, setResetUser] = useState<any>(null);
  const [shareUser, setShareUser] = useState<any>(null);
  const [credsOpen, setCredsOpen] = useState(false);
  const [creds, setCreds] = useState<Credentials | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminListUsers();
      setUsers(Array.isArray(res) ? res : []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load users");
      setUsers([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const [nf, setNf] = useState({
    full_name: "", email: "", phone: "",
    password: generateTempPassword(), role: "office",
  });
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    if (!nf.full_name || !nf.email || nf.password.length < 8) {
      toast.error("Fill all fields (password ≥ 8 chars)");
      return;
    }
    setBusy(true);
    try {
      const res: any = await adminCreateUser({
        email: nf.email,
        full_name: nf.full_name,
        phone: nf.phone || null,
        password: nf.password,
        role: nf.role as "super_admin" | "office" | "rider",
      });
      toast.success("User created");
      setOpenNew(false);
      setCreds({
        staff_code: res.staff_code,
        full_name: res.full_name,
        email: res.email,
        password: nf.password,
        phone: res.phone,
        role: res.role,
      });
      setCredsOpen(true);
      setNf({ full_name: "", email: "", phone: "", password: generateTempPassword(), role: "office" });
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create user");
    } finally {
      setBusy(false);
    }
  };

  const [newPwd, setNewPwd] = useState("");
  const [shareAfterReset, setShareAfterReset] = useState(false);

  const onReset = async () => {
    if (!resetUser || newPwd.length < 8) return;
    setBusy(true);
    try {
      await adminResetPassword({ user_id: resetUser.id, new_password: newPwd });
      toast.success("Password updated");
      const target = resetUser;
      const pwd = newPwd;
      const wantShare = shareAfterReset;
      setResetUser(null); setNewPwd(""); setShareAfterReset(false);
      if (wantShare) {
        setCreds({
          staff_code: target.staff_code,
          full_name: target.full_name,
          email: target.email,
          password: pwd,
          phone: target.phone,
          role: target.role,
        });
        setCredsOpen(true);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const [sharePwd, setSharePwd] = useState("");

  const onOpenShare = (u: any) => { setSharePwd(""); setShareUser(u); };

  const onConfirmShare = () => {
    if (!shareUser || sharePwd.length < 4) return;
    setCreds({
      staff_code: shareUser.staff_code,
      full_name: shareUser.full_name,
      email: shareUser.email,
      password: sharePwd,
      phone: shareUser.phone,
      role: shareUser.role,
    });
    setShareUser(null);
    setSharePwd("");
    setCredsOpen(true);
  };

  const onToggleActive = async (u: any) => {
    try {
      await adminSetActive({ user_id: u.id, is_active: !u.is_active });
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">User Management</h1>
          <p className="text-sm text-muted-foreground">Create and manage Super Admins, Admins, and Riders.</p>
        </div>
        <Dialog open={openNew} onOpenChange={(o) => {
          setOpenNew(o);
          if (o) setNf((n) => ({ ...n, password: generateTempPassword() }));
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
              <Plus className="mr-2 h-4 w-4" /> New user
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create user</DialogTitle>
              <DialogDescription>An ID is auto-generated. You'll be able to share credentials right after.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Full name</Label>
                <Input value={nf.full_name} onChange={(e) => setNf({ ...nf, full_name: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={nf.email} onChange={(e) => setNf({ ...nf, email: e.target.value })} />
              </div>
              <div>
                <Label>Phone (for SMS / WhatsApp)</Label>
                <Input type="tel" value={nf.phone} onChange={(e) => setNf({ ...nf, phone: e.target.value })} placeholder="+254700000000" />
              </div>
              <div>
                <Label>Temporary password</Label>
                <div className="flex gap-2">
                  <Input type="text" value={nf.password} onChange={(e) => setNf({ ...nf, password: e.target.value })} />
                  <Button type="button" variant="outline" onClick={() => setNf({ ...nf, password: generateTempPassword() })}>New</Button>
                </div>
              </div>
              <div>
                <Label>Role</Label>
                <select value={nf.role} onChange={(e) => setNf({ ...nf, role: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2">
                  <option value="super_admin">Super Admin</option>
                  <option value="office">Admin</option>
                  <option value="rider">Rider</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenNew(false)}>Cancel</Button>
              <Button onClick={onCreate} disabled={busy} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
        </div>
      ) : users.length === 0 ? (
        <Card className="border-border/60 bg-card/60 p-6 text-center text-sm text-muted-foreground">
          No users yet. Tap <span className="text-primary">New user</span> to add one.
        </Card>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <Card key={u.id} className="border-border/60 bg-card p-3 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-primary">{u.staff_code || "—"}</span>
                    <span className="truncate text-sm font-medium">{u.full_name || "(no name)"}</span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {u.email}{u.phone ? ` · ${u.phone}` : ""}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
                      {ROLE_LABEL[u.role] || u.role || "no role"}
                    </Badge>
                    {!u.is_active && (
                      <Badge variant="outline" className="border-destructive/40 text-destructive">Inactive</Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => onOpenShare(u)} aria-label="Share credentials">
                    <Share2 className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setResetUser(u)} aria-label="Reset password">
                    <KeyRound className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onToggleActive(u)} aria-label="Toggle active">
                    <Power className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Reset password */}
      <Dialog open={!!resetUser} onOpenChange={(o) => {
        if (!o) { setResetUser(null); setNewPwd(""); setShareAfterReset(false); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password — {resetUser?.email}</DialogTitle>
            <DialogDescription>Set a new password for this user.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>New password</Label>
            <div className="flex gap-2">
              <Input type="text" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="min 8 chars" />
              <Button type="button" variant="outline" onClick={() => setNewPwd(generateTempPassword())}>Generate</Button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={shareAfterReset} onChange={(e) => setShareAfterReset(e.target.checked)} />
            Open share dialog after reset
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetUser(null); setNewPwd(""); setShareAfterReset(false); }}>
              Cancel
            </Button>
            <Button onClick={onReset} disabled={busy || newPwd.length < 8}
              className="bg-primary text-primary-foreground hover:bg-primary/90">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share credentials */}
      <Dialog open={!!shareUser} onOpenChange={(o) => !o && setShareUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share credentials — {shareUser?.email}</DialogTitle>
            <DialogDescription>
              For security we don't store passwords. Enter the password you want to share, or reset it from the key icon first.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Password to share</Label>
            <Input type="text" value={sharePwd} onChange={(e) => setSharePwd(e.target.value)}
              placeholder="Type the password to send" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareUser(null)}>Cancel</Button>
            <Button onClick={onConfirmShare} disabled={sharePwd.length < 4}
              className="bg-primary text-primary-foreground hover:bg-primary/90">
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CredentialsDialog open={credsOpen} onOpenChange={setCredsOpen} credentials={creds} />
    </div>
  );
}
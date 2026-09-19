import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSocialSettings, useUpdateSocialSettings } from "@/hooks/useSiteSettings";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Save, Send, Twitter, KeyRound } from "lucide-react";

export default function AdminSettings() {
  const { isAdmin, loading } = useAuth();
  const { data, isLoading } = useSocialSettings();
  const update = useUpdateSocialSettings();
  const [telegram, setTelegram] = useState("");
  const [twitter, setTwitter] = useState("");
  const [pwEmail, setPwEmail] = useState("");
  const [pwValue, setPwValue] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const resetPassword = async () => {
    if (pwValue.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    setPwBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-password", {
        body: { email: pwEmail.trim(), password: pwValue },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Password updated for ${pwEmail}`);
      setPwValue("");
    } catch (e: any) {
      toast.error(e.message || "Failed to reset password");
    } finally {
      setPwBusy(false);
    }
  };

  useEffect(() => {
    if (data) {
      setTelegram(data.telegram_url);
      setTwitter(data.twitter_url);
    }
  }, [data]);

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin inline" /></div>;
  if (!isAdmin) return <Navigate to="/login" replace />;

  const save = async () => {
    try {
      await update.mutateAsync({ telegram_url: telegram.trim(), twitter_url: twitter.trim() });
      toast.success("Social links saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    }
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-bold tracking-wider">Site Settings</h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Social links displayed on the homepage and about page.
        </p>
      </div>

      <Card className="p-5 space-y-4">
        {isLoading ? (
          <Loader2 className="animate-spin" />
        ) : (
          <>
            <div className="space-y-2">
              <Label className="font-mono text-xs flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5 text-primary" /> Telegram URL
              </Label>
              <Input
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="https://t.me/your_channel"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-xs flex items-center gap-1.5">
                <Twitter className="h-3.5 w-3.5 text-primary" /> Twitter / X URL
              </Label>
              <Input
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="https://x.com/your_handle"
                className="font-mono text-sm"
              />
            </div>
            <Button onClick={save} disabled={update.isPending} className="gap-2 font-mono">
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
            <p className="font-mono text-[10px] text-muted-foreground">
              Leave a field blank to hide that link. Changes appear on the public site immediately.
            </p>
          </>
        )}
      </Card>

      <Card className="p-5 space-y-4 border-amber-500/30">
        <div>
          <h2 className="font-mono text-sm font-bold tracking-wider flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-amber-500" /> Reset User Password
          </h2>
          <p className="font-mono text-[10px] text-muted-foreground mt-1">
            Admin-only. Sets a new password for an authorized user account.
          </p>
        </div>
        <div className="space-y-2">
          <Label className="font-mono text-xs">User Email</Label>
          <Input
            value={pwEmail}
            onChange={(e) => setPwEmail(e.target.value)}
            placeholder="admin@example.com"
            className="font-mono text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="font-mono text-xs">New Password (min 4 chars)</Label>
          <Input
            type="password"
            value={pwValue}
            onChange={(e) => setPwValue(e.target.value)}
            placeholder="••••••••••"
            className="font-mono text-sm"
            autoComplete="new-password"
          />
        </div>
        <Button onClick={resetPassword} disabled={pwBusy} variant="destructive" className="gap-2 font-mono">
          {pwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Set Password
        </Button>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setLoading(false);
      toast({ title: "Authentication failed", description: error.message, variant: "destructive" });
      return;
    }
    // Resolve where to send the user based on roles
    try {
      const { data: sess } = await supabase.auth.getUser();
      const uid = sess.user?.id;
      if (!uid) { navigate("/admin"); return; }
      const [adminRes, militantRes] = await Promise.all([
        supabase.rpc("has_role", { _user_id: uid, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: uid, _role: "militant_admin" as any }),
      ]);
      const isAdmin = !!adminRes.data;
      const isMilitant = !!militantRes.data;
      if (isAdmin) navigate("/admin");
      else if (isMilitant) navigate("/admin/militant");
      else navigate("/");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <Shield className="h-10 w-10 text-primary mx-auto" />
          <h1 className="font-mono text-lg font-semibold tracking-wider">ADMIN ACCESS</h1>
          <p className="text-xs text-muted-foreground font-mono">Authorized personnel only</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="font-mono text-sm bg-secondary border-border" />
          </div>
          <div className="space-y-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="font-mono text-sm bg-secondary border-border" />
          </div>
          <Button type="submit" className="w-full font-mono text-xs" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "AUTHENTICATE"}
          </Button>
        </form>
      </div>
    </div>
  );
}

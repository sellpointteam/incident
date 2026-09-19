import { useState, useEffect, createContext, useContext, ReactNode, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import type { User, Session } from "@supabase/supabase-js";

type AuthStatus = "loading" | "ready";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isMilitantAdmin: boolean;
  loading: boolean;
  status: AuthStatus;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionReady(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;

  const adminQuery = useQuery({
    queryKey: qk.auth.isAdmin(user?.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      if (!user?.id) return { admin: false, militant: false };
      const [adminRes, militantRes] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: user.id, _role: "militant_admin" as any }),
      ]);
      return {
        admin: !!adminRes.data,
        militant: !!militantRes.data,
      };
    },
  });

  const isAdmin = !!user && adminQuery.data?.admin === true;
  const isMilitantAdmin = !!user && adminQuery.data?.militant === true;

  const status: AuthStatus = useMemo(() => {
    if (!sessionReady) return "loading";
    if (!user) return "ready";
    if (adminQuery.isFetched || adminQuery.isError) return "ready";
    return "loading";
  }, [sessionReady, user, adminQuery.isFetched, adminQuery.isError]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value: AuthContextType = {
    user,
    session,
    isAdmin,
    isMilitantAdmin,
    loading: status === "loading",
    status,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

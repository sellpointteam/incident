import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The page you requested could not be located.
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
    </div>
  );
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { status, user, isAdmin } = useAuth();
  const location = useLocation();

  if (status === "loading") return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!isAdmin) return <NotFound />;
  return <>{children}</>;
}

/** Allows users with either admin OR militant_admin role. */
export function RequireMilitantOrAdmin({ children }: { children: ReactNode }) {
  const { status, user, isAdmin, isMilitantAdmin } = useAuth();
  const location = useLocation();

  if (status === "loading") return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!isAdmin && !isMilitantAdmin) return <NotFound />;
  return <>{children}</>;
}

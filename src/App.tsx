import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAdmin, RequireMilitantOrAdmin } from "@/components/RequireAdmin";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";
import Index from "./pages/Index";
import { Toaster } from "sonner";
import { useCasualtyRealtime } from "@/hooks/useCasualtyRealtime";

const IncidentList = lazy(() => import("./pages/IncidentList"));
const Login = lazy(() => import("./pages/Login"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminExports = lazy(() => import("./pages/AdminExports"));
const KiaTracker = lazy(() => import("./pages/KiaTracker"));
const About = lazy(() => import("./pages/About"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const AdminBlog = lazy(() => import("./pages/AdminBlog"));
const AdminBlogEditor = lazy(() => import("./pages/AdminBlogEditor"));
const Analytics = lazy(() => import("./pages/Analytics"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminGeography = lazy(() => import("./pages/AdminGeography"));
const AdminActors = lazy(() => import("./pages/AdminActors"));

const AdminIntegrity = lazy(() => import("./pages/AdminIntegrity"));
const AdminChangelog = () => null;
const AdminMilitantCasualties = lazy(() => import("./pages/AdminMilitantCasualties"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="min-h-[60vh] flex items-center justify-center text-xs font-mono text-muted-foreground uppercase tracking-wider">
    Loading…
  </div>
);

const RealtimeBridge = () => {
  useCasualtyRealtime();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster position="top-right" />
    <BrowserRouter>
      <AuthProvider>
        <RealtimeBridge />
        <AppHeader />
        <main>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/incidents" element={<Navigate to="/?tab=incidents" replace />} />
              <Route path="/kia" element={<KiaTracker />} />
              <Route path="/incidents/full" element={<IncidentList />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/about" element={<About />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/login" element={<Login />} />

              {/* Incident entry (the only admin entry path) */}
              <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
              <Route path="/admin/legacy" element={<Navigate to="/admin" replace />} />
              <Route path="/admin/console" element={<Navigate to="/admin" replace />} />
              <Route path="/admin/review-queue" element={<Navigate to="/admin" replace />} />
              <Route path="/admin/channels" element={<Navigate to="/admin" replace />} />
              <Route path="/admin/manual-extract" element={<Navigate to="/admin" replace />} />
              <Route path="/admin/incidents" element={<Navigate to="/admin" replace />} />
              <Route path="/admin/clusters" element={<Navigate to="/admin" replace />} />

              <Route path="/admin/exports" element={<RequireAdmin><AdminExports /></RequireAdmin>} />
              <Route path="/admin/blog" element={<RequireAdmin><AdminBlog /></RequireAdmin>} />
              <Route path="/admin/blog/:id" element={<RequireAdmin><AdminBlogEditor /></RequireAdmin>} />
              <Route path="/admin/settings" element={<RequireAdmin><AdminSettings /></RequireAdmin>} />
              <Route path="/admin/locations" element={<RequireAdmin><AdminGeography /></RequireAdmin>} />
              <Route path="/admin/geography" element={<Navigate to="/admin/locations" replace />} />
              <Route path="/admin/actors" element={<RequireAdmin><AdminActors /></RequireAdmin>} />
              <Route path="/admin/operational-areas" element={<Navigate to="/admin" replace />} />
              <Route path="/admin/integrity" element={<RequireAdmin><AdminIntegrity /></RequireAdmin>} />
              <Route path="/admin/changelog" element={<Navigate to="/about" replace />} />
              <Route path="/admin/militant" element={<RequireMilitantOrAdmin><AdminMilitantCasualties /></RequireMilitantOrAdmin>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useViewablePosts, type BlogPost } from "@/hooks/useBlog";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, LayoutGrid, List as ListIcon, SlidersHorizontal, FileText } from "lucide-react";
import SEO from "@/components/SEO";
import FeaturedArticle from "@/components/blog/FeaturedArticle";
import ArticleCard from "@/components/blog/ArticleCard";
import BlogPagination from "@/components/blog/BlogPagination";

const CATEGORIES = [
  "Operations",
  "Incident Analysis",
  "Group Profile",
  "Data Report",
  "Field Dispatch",
  "Commentary",
];

const REGIONS = [
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Punjab",
  "Sindh",
  "Gilgit-Baltistan",
  "Azad Kashmir",
  "Islamabad",
];

const ACTORS = ["TTP", "BLA", "ISIS-K", "Pakistan Army", "Frontier Corps", "Police"];

type SortMode = "newest" | "oldest" | "most-viewed";
type ViewMode = "grid" | "list";
type StatusFilter = "all" | "published" | "draft";

const LAYOUT_KEY = "blog:layout";

function matchesText(post: BlogPost, q: string) {
  if (!q) return true;
  const hay = `${post.title} ${post.excerpt ?? ""} ${post.content ?? ""}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

export default function Blog() {
  const { isAdmin } = useAuth();
  const { data: posts, isLoading } = useViewablePosts(isAdmin);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [region, setRegion] = useState<string>("all");
  const [actor, setActor] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "grid";
    return (localStorage.getItem(LAYOUT_KEY) as ViewMode) || "grid";
  });
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const perPage = 9;

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(LAYOUT_KEY, view);
  }, [view]);

  useEffect(() => {
    setPage(1);
  }, [search, category, region, actor, status, sort]);

  const { featured, rest } = useMemo(() => {
    const list = posts ?? [];
    const filtered = list.filter((p) => {
      if (!matchesText(p, search)) return false;
      if (category !== "all" && (p.category ?? "") !== category) return false;
      if (region !== "all") {
        const hay = `${p.title} ${p.excerpt ?? ""} ${p.content ?? ""}`.toLowerCase();
        if (!hay.includes(region.toLowerCase())) return false;
      }
      if (actor !== "all") {
        const hay = `${p.title} ${p.excerpt ?? ""} ${p.content ?? ""}`.toLowerCase();
        if (!hay.includes(actor.toLowerCase())) return false;
      }
      if (status === "published" && !p.published) return false;
      if (status === "draft" && p.published) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sort === "most-viewed") return (b.view_count ?? 0) - (a.view_count ?? 0);
      const da = new Date(a.published_at ?? a.updated_at).getTime();
      const db = new Date(b.published_at ?? b.updated_at).getTime();
      return sort === "oldest" ? da - db : db - da;
    });

    // Featured: explicit featured flag first, else newest published, else newest draft (admin only)
    let feat: BlogPost | null = null;
    const explicit = sorted.find((p) => p.featured && (p.published || isAdmin));
    if (explicit) feat = explicit;
    else {
      const pub = sorted.find((p) => p.published);
      feat = pub ?? (isAdmin ? sorted[0] ?? null : null);
    }
    const restList = feat ? sorted.filter((p) => p.id !== feat!.id) : sorted;
    return { featured: feat, rest: restList };
  }, [posts, search, category, region, actor, status, sort, isAdmin]);

  const totalPages = Math.max(1, Math.ceil(rest.length / perPage));
  const pageItems = rest.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Analysis & Dispatches — Pakistani Casualty Tracker"
        description="Research, incident analysis and field reporting from the Pakistani Casualty Tracker OSINT team."
        path="/blog"
      />

      <div className="container mx-auto max-w-[1280px] px-4 sm:px-6 py-8 lg:py-10">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 flex-wrap mb-6 lg:mb-8">
          <div className="min-w-0">
            <h1 className="font-sans text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
              Analysis &amp; Dispatches
            </h1>
            <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-2xl">
              Research, incident analysis and field reporting from the Pakistani Casualty Tracker team.
            </p>
          </div>
          {isAdmin && (
            <Button asChild size="lg" className="gap-2 font-semibold shrink-0">
              <Link to="/admin/blog/new">
                <Plus className="h-4 w-4" /> New Post
              </Link>
            </Button>
          )}
        </header>

        {/* Toolbar */}
        <div className="rounded-xl border border-border/60 bg-card/50 p-3 md:p-4 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search analysis and dispatches..."
                className="pl-9 h-10 bg-background/60"
                aria-label="Search blog"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden self-start gap-2"
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </Button>
            <div className={`${showFilters ? "grid" : "hidden"} lg:flex grid-cols-2 sm:grid-cols-3 lg:flex-nowrap gap-2 lg:items-center`}>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-10 min-w-[140px] bg-background/60"><SelectValue placeholder="All Types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger className="h-10 min-w-[140px] bg-background/60"><SelectValue placeholder="All Regions" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={actor} onValueChange={setActor}>
                <SelectTrigger className="h-10 min-w-[140px] bg-background/60"><SelectValue placeholder="All Actors" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actors</SelectItem>
                  {ACTORS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
              {isAdmin && (
                <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                  <SelectTrigger className="h-10 min-w-[140px] bg-background/60"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
                <SelectTrigger className="h-10 min-w-[150px] bg-background/60"><SelectValue placeholder="Newest First" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="most-viewed">Most Viewed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <>
            <Skeleton className="h-[380px] w-full rounded-xl mb-10" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[320px] w-full rounded-xl" />
              ))}
            </div>
          </>
        )}

        {/* Empty */}
        {!isLoading && (!posts || posts.length === 0) && (
          <EmptyState
            title="No posts yet"
            body="Once articles are published they will appear here."
          />
        )}

        {!isLoading && posts && posts.length > 0 && !featured && rest.length === 0 && (
          <EmptyState
            title="No matching articles"
            body="Try clearing filters or adjusting your search."
          />
        )}

        {/* Featured */}
        {!isLoading && featured && (
          <div className="mb-10">
            <FeaturedArticle post={featured} isAdmin={isAdmin} />
          </div>
        )}

        {/* Latest */}
        {!isLoading && rest.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-sans text-xl md:text-2xl font-semibold text-foreground">Latest Analysis</h2>
              <div className="inline-flex rounded-md border border-border/60 bg-card/60 p-0.5" role="tablist" aria-label="Layout">
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "grid"}
                  aria-label="Grid layout"
                  onClick={() => setView("grid")}
                  className={`h-8 w-8 inline-flex items-center justify-center rounded-sm transition-colors ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "list"}
                  aria-label="List layout"
                  onClick={() => setView("list")}
                  className={`h-8 w-8 inline-flex items-center justify-center rounded-sm transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <ListIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            {view === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {pageItems.map((p, i) => (
                  <ArticleCard key={p.id} post={p} isAdmin={isAdmin} variant="grid" priority={i < 3} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {pageItems.map((p) => (
                  <ArticleCard key={p.id} post={p} isAdmin={isAdmin} variant="list" />
                ))}
              </div>
            )}

            <BlogPagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 py-16 px-6 text-center">
      <FileText className="mx-auto h-8 w-8 text-muted-foreground/60" />
      <p className="mt-3 font-sans text-lg font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

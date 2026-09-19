import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Clock, Eye, Calendar } from "lucide-react";
import ResponsiveArticleImage from "./ResponsiveArticleImage";
import ArticleAdminMenu from "./ArticleAdminMenu";
import type { BlogPost } from "@/hooks/useBlog";

export function estimatedReadingTime(post: BlogPost): number {
  if (post.reading_time_minutes && post.reading_time_minutes > 0) return post.reading_time_minutes;
  const words = (post.content || post.excerpt || "").trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}

export function articleSnippet(post: BlogPost, max = 200): string {
  const raw =
    post.excerpt?.trim() ||
    (post.content || "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[#>*_`~]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  if (raw.length <= max) return raw;
  return raw.slice(0, max).trimEnd() + "…";
}

const CATEGORY_TONES: Record<string, string> = {
  Operations: "border-amber-500/50 text-amber-300 bg-amber-500/10",
  "Incident Analysis": "border-sky-500/50 text-sky-300 bg-sky-500/10",
  "Group Profile": "border-violet-500/50 text-violet-300 bg-violet-500/10",
  "Data Report": "border-emerald-500/50 text-emerald-300 bg-emerald-500/10",
  "Field Dispatch": "border-orange-500/50 text-orange-300 bg-orange-500/10",
  Commentary: "border-pink-500/50 text-pink-300 bg-pink-500/10",
};

export function CategoryBadge({ category }: { category?: string | null }) {
  if (!category) return null;
  const tone = CATEGORY_TONES[category] ?? "border-border text-muted-foreground bg-muted/30";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tone}`}
    >
      {category}
    </span>
  );
}

export function DraftBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/60 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-300">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Draft
    </span>
  );
}

export function PublishedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Published
    </span>
  );
}

interface CardProps {
  post: BlogPost;
  isAdmin: boolean;
  variant?: "grid" | "list";
  priority?: boolean;
}

export default function ArticleCard({ post, isAdmin, variant = "grid", priority = false }: CardProps) {
  const displayDate = post.published_at ?? post.updated_at;
  const readTime = estimatedReadingTime(post);
  const snippet = articleSnippet(post, variant === "list" ? 260 : 140);

  if (variant === "list") {
    return (
      <article className="group relative rounded-xl border border-border/60 bg-card/60 hover:border-primary/50 transition-colors overflow-hidden">
        <Link to={`/blog/${post.slug}`} className="grid grid-cols-[160px,1fr] sm:grid-cols-[220px,1fr] gap-4 p-3">
          <ResponsiveArticleImage
            src={post.cover_image_url}
            alt={post.title}
            imageFit={post.image_fit}
            focalX={post.focal_x}
            focalY={post.focal_y}
            aspect="4 / 3"
            priority={priority}
            rounded="rounded-md"
          />
          <div className="min-w-0 flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <CategoryBadge category={post.category} />
              {!post.published && <DraftBadge />}
            </div>
            <h3 className="font-sans text-lg font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
              {post.title || "(untitled)"}
            </h3>
            {snippet && <p className="text-sm text-muted-foreground line-clamp-2">{snippet}</p>}
            <MetaRow date={displayDate} readTime={readTime} views={post.view_count ?? 0} />
          </div>
        </Link>
        {isAdmin && (
          <div className="absolute top-2 right-2 z-10">
            <ArticleAdminMenu post={post} />
          </div>
        )}
      </article>
    );
  }

  return (
    <article className="group relative rounded-xl border border-border/60 bg-card/60 hover:border-primary/50 transition-colors overflow-hidden flex flex-col">
      <Link to={`/blog/${post.slug}`} className="block relative">
        <ResponsiveArticleImage
          src={post.cover_image_url}
          alt={post.title}
          imageFit={post.image_fit}
          focalX={post.focal_x}
          focalY={post.focal_y}
          aspect="16 / 9"
          priority={priority}
          rounded="rounded-none"
        />
        {isAdmin && (
          <div className="absolute top-2 right-2 z-10">
            <ArticleAdminMenu post={post} />
          </div>
        )}
      </Link>
      <Link to={`/blog/${post.slug}`} className="flex-1 flex flex-col p-4 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <CategoryBadge category={post.category} />
          {!post.published && <DraftBadge />}
        </div>
        <h3 className="font-sans text-base font-semibold leading-snug text-foreground line-clamp-3 group-hover:text-primary transition-colors">
          {post.title || "(untitled)"}
        </h3>
        <div className="mt-auto pt-2">
          <MetaRow date={displayDate} readTime={readTime} views={post.view_count ?? 0} compact />
        </div>
      </Link>
    </article>
  );
}

function MetaRow({ date, readTime, views, compact }: { date: string; readTime: number; views: number; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-3 flex-wrap font-mono text-[11px] text-muted-foreground ${compact ? "" : "pt-1"}`}>
      <span className="inline-flex items-center gap-1">
        <Calendar className="h-3 w-3" /> {format(new Date(date), "MMM d, yyyy")}
      </span>
      <span className="inline-flex items-center gap-1">
        <Clock className="h-3 w-3" /> {readTime} min read
      </span>
      <span className="inline-flex items-center gap-1">
        <Eye className="h-3 w-3" /> {views.toLocaleString()}
      </span>
    </div>
  );
}

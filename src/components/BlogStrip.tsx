import { Link } from "react-router-dom";
import { format } from "date-fns";
import { BookOpen, ArrowRight } from "lucide-react";
import { usePublishedPosts } from "@/hooks/useBlog";

export default function BlogStrip() {
  const { data: posts, isLoading } = usePublishedPosts();
  const items = (posts || []).slice(0, 4);
  if (!isLoading && items.length === 0) return null;

  return (
    <section className="px-3 lg:px-4 pb-4 pt-1">
      <div className="rounded-xl glass p-3 lg:p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground">
              Field Reports & Analysis
            </h2>
          </div>
          <Link
            to="/blog"
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-primary hover:text-primary-glow"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-lg bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {items.map((p) => (
              <Link
                key={p.id}
                to={`/blog/${p.slug}`}
                className="group flex gap-3 rounded-lg border border-border/60 bg-card/40 p-2.5 hover:border-primary/50 hover:bg-card/70 transition-colors"
              >
                {p.cover_image_url ? (
                  <img
                    src={p.cover_image_url}
                    alt={p.title}
                    loading="lazy"
                    className="h-16 w-16 rounded-md object-cover shrink-0"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-md bg-gradient-to-br from-primary/20 to-secondary/30 shrink-0 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-primary/70" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {p.published_at ? format(new Date(p.published_at), "dd MMM yy") : "—"}
                  </p>
                  <h3 className="text-xs font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                    {p.title}
                  </h3>
                  {(() => {
                    const preview = (p.excerpt && p.excerpt.trim()) ||
                      (p.content || "")
                        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
                        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
                        .replace(/[#>*_`~]/g, "")
                        .replace(/\s+/g, " ")
                        .trim()
                        .slice(0, 180);
                    return preview ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                        {preview}
                      </p>
                    ) : null;
                  })()}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

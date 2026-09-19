import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { usePostBySlug } from "@/hooks/useBlog";
import { format } from "date-fns";
import MarkdownContent from "@/components/MarkdownContent";
import ResponsiveArticleImage from "@/components/blog/ResponsiveArticleImage";
import { ArrowLeft, Eye } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorHash } from "@/lib/visitorFingerprint";
import { useQueryClient } from "@tanstack/react-query";

export default function BlogPost() {
  const { slug } = useParams();
  const { data: post, isLoading } = usePostBySlug(slug);
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!slug || !post?.published) return;
    let cancelled = false;
    (async () => {
      try {
        const visitorHash = getVisitorHash();
        const { data, error } = await supabase.rpc("record_blog_view" as any, {
          _slug: slug,
          _visitor_hash: visitorHash,
          _user_agent: navigator.userAgent?.slice(0, 500) ?? null,
        });
        if (error) {
          console.error("[blog-view] RPC failed:", error);
          return;
        }
        const newCount = typeof data === "number" ? data : Number(data);
        console.log("[blog-view] recorded for", slug, "count:", newCount);
        if (!cancelled && Number.isFinite(newCount)) {
          queryClient.setQueryData(["blog_posts", "slug", slug], (old: any) =>
            old ? { ...old, view_count: newCount } : old
          );
          queryClient.invalidateQueries({ queryKey: ["blog_posts"] });
        }
      } catch (e) {
        console.error("[blog-view] unexpected error:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, post?.published, queryClient]);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <p className="font-mono text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <p className="font-mono text-sm text-muted-foreground">Post not found.</p>
        <Link to="/blog" className="font-mono text-sm text-primary mt-4 inline-block">
          ← Back to blog
        </Link>
      </div>
    );
  }

  if (!post.published && !isAdmin) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <p className="font-mono text-sm text-muted-foreground">This post is not available.</p>
      </div>
    );
  }

  return (
    <article className="container mx-auto max-w-3xl px-4 py-8">
      <SEO
        title={`${post.title} — Pakistani Casualty Tracker`}
        description={post.excerpt || post.title}
        path={`/blog/${post.slug}`}
        ogType="article"
        image={post.cover_image_url || undefined}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description: post.excerpt || undefined,
          datePublished: post.published_at || post.created_at,
          dateModified: post.updated_at,
          image: post.cover_image_url || undefined,
          mainEntityOfPage: `https://example.invalid/blog/${post.slug}`,
        }}
      />
      <div className="flex items-center justify-between mb-6">
        <Link to="/blog" className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to blog
        </Link>
        {isAdmin && (
          <Link to={`/admin/blog/${post.id}`} className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline">
            Edit post →
          </Link>
        )}
      </div>


      {!post.published && (
        <div className="mb-4 rounded border border-amber-500/50 bg-amber-500/10 px-3 py-2 font-mono text-xs text-amber-300">
          DRAFT — not visible to the public
        </div>
      )}

      <h1 className="font-mono text-3xl md:text-4xl font-bold tracking-wider mb-2">{post.title}</h1>
      {(() => {
        const publishedAt = post.published_at ? new Date(post.published_at) : new Date(post.created_at);
        const updatedAt = new Date(post.updated_at);
        // Trigger now only bumps updated_at on real content edits; treat any
        // post-publish bump > 60 seconds as a genuine edit.
        const wasUpdated = updatedAt.getTime() - publishedAt.getTime() > 60 * 1000;
        return (
          <p className="font-mono text-xs text-muted-foreground mb-6 flex items-center gap-3 flex-wrap">
            <span>Published {format(publishedAt, "MMMM d, yyyy")}</span>
            {wasUpdated && (
              <span className="text-amber-400/80">
                · Updated {format(updatedAt, "MMMM d, yyyy")}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {(post.view_count ?? 0).toLocaleString()} views
            </span>
          </p>
        );
      })()}

      {post.cover_image_url && (
        <div className="mb-6">
          <ResponsiveArticleImage
            src={post.cover_image_url}
            alt={post.title}
            imageFit={post.image_fit}
            focalX={post.focal_x}
            focalY={post.focal_y}
            aspect="16 / 9"
            priority
          />
        </div>
      )}

      <MarkdownContent content={post.content} />
    </article>
  );
}

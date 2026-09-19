import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowRight, Calendar, Clock, Eye, Star } from "lucide-react";
import ResponsiveArticleImage from "./ResponsiveArticleImage";
import ArticleAdminMenu from "./ArticleAdminMenu";
import { CategoryBadge, DraftBadge, PublishedBadge, articleSnippet, estimatedReadingTime } from "./ArticleCard";
import type { BlogPost } from "@/hooks/useBlog";

interface Props {
  post: BlogPost;
  isAdmin: boolean;
}

export default function FeaturedArticle({ post, isAdmin }: Props) {
  const displayDate = post.published_at ?? post.updated_at;
  const readTime = estimatedReadingTime(post);
  const snippet = articleSnippet(post, 320);

  return (
    <article className="relative rounded-xl border border-border/60 bg-card/70 overflow-hidden hover:border-primary/50 transition-colors">
      <Link
        to={`/blog/${post.slug}`}
        className="grid grid-cols-1 md:grid-cols-2 gap-0 min-h-[320px] md:min-h-[380px]"
      >
        <div className="relative">
          <ResponsiveArticleImage
            src={post.cover_image_url}
            alt={post.title}
            imageFit={post.image_fit}
            focalX={post.focal_x}
            focalY={post.focal_y}
            aspect="4 / 3"
            priority
            rounded="rounded-none"
            className="h-full"
          />
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-md border border-primary/60 bg-background/80 backdrop-blur px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-primary">
            <Star className="h-3 w-3 fill-current" /> Featured
          </span>
        </div>
        <div className="flex flex-col p-6 md:p-8 gap-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <CategoryBadge category={post.category} />
              {!post.published && <DraftBadge />}
            </div>
            {post.published && <PublishedBadge />}
          </div>
          <h2 className="font-sans text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-tight">
            {post.title || "(untitled)"}
          </h2>
          {snippet && (
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed line-clamp-5">
              {snippet}
            </p>
          )}
          <div className="mt-auto flex items-end justify-between gap-4 flex-wrap pt-2">
            <div className="flex items-center gap-4 flex-wrap font-mono text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3 w-3" /> {format(new Date(displayDate), "MMM d, yyyy")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> {readTime} min read
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Eye className="h-3 w-3" /> {(post.view_count ?? 0).toLocaleString()} views
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 font-mono text-xs text-primary group-hover:text-primary-glow font-semibold">
              Read Analysis <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </Link>
      {isAdmin && (
        <div className="absolute top-3 right-3 z-10">
          <ArticleAdminMenu post={post} />
        </div>
      )}
    </article>
  );
}

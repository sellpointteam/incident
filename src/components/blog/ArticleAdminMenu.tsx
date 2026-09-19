import { Link } from "react-router-dom";
import { MoreVertical, Eye, Pencil, Star, StarOff, Trash2, CheckCircle2, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { BlogPost } from "@/hooks/useBlog";

interface Props {
  post: BlogPost;
}

export default function ArticleAdminMenu({ post }: Props) {
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["blog_posts"] });

  const togglePublish = async () => {
    const willPublish = !post.published;
    const patch: Record<string, unknown> = { published: willPublish };
    if (willPublish && !post.published_at) patch.published_at = new Date().toISOString();
    const { error } = await supabase.from("blog_posts").update(patch).eq("id", post.id);
    if (error) return toast.error(error.message);
    toast.success(willPublish ? "Published" : "Unpublished");
    invalidate();
  };

  const toggleFeatured = async () => {
    const next = !post.featured;
    const { error } = await supabase
      .from("blog_posts")
      .update({ featured: next } as never)
      .eq("id", post.id);
    if (error) return toast.error(error.message);
    toast.success(next ? "Marked as featured" : "Removed from featured");
    invalidate();
  };

  const remove = async () => {
    if (!confirm("Delete this post permanently?")) return;
    const { error } = await supabase.from("blog_posts").delete().eq("id", post.id);
    if (error) return toast.error(error.message);
    toast.success("Post deleted");
    invalidate();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Article actions"
          className="h-8 w-8 rounded-md bg-black/60 hover:bg-black/80 text-foreground border border-border/50"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem asChild>
          <Link to={`/blog/${post.slug}`} className="cursor-pointer">
            <Eye className="h-4 w-4 mr-2" /> Preview
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/admin/blog/${post.id}`} className="cursor-pointer">
            <Pencil className="h-4 w-4 mr-2" /> Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={togglePublish} className="cursor-pointer">
          {post.published ? (
            <><EyeOff className="h-4 w-4 mr-2" /> Unpublish</>
          ) : (
            <><CheckCircle2 className="h-4 w-4 mr-2" /> Publish</>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleFeatured} className="cursor-pointer">
          {post.featured ? (
            <><StarOff className="h-4 w-4 mr-2" /> Unfeature</>
          ) : (
            <><Star className="h-4 w-4 mr-2" /> Feature</>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={remove} className="cursor-pointer text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

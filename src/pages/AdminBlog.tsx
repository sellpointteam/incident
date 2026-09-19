import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAllPostsAdmin } from "@/hooks/useBlog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminBlog() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { data: posts, isLoading } = useAllPostsAdmin();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/login");
  }, [loading, user, isAdmin, navigate]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this post permanently?")) return;
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Post deleted");
      qc.invalidateQueries({ queryKey: ["blog_posts"] });
    }
  };

  const drafts = posts?.filter((p) => !p.published) ?? [];
  const published = posts?.filter((p) => p.published) ?? [];

  const list = (items: typeof posts) => (
    <div className="space-y-3">
      {items?.length === 0 && (
        <p className="font-mono text-sm text-muted-foreground">No posts here.</p>
      )}
      {items?.map((p) => (
        <Card key={p.id} className="p-4 flex items-center gap-4">
          {p.cover_image_url && (
            <img src={p.cover_image_url} className="h-14 w-14 rounded object-cover" alt="" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-mono font-bold truncate">{p.title || "(untitled)"}</p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {p.published ? "Published" : "Draft"} ·{" "}
              {format(new Date(p.updated_at), "MMM d, yyyy")} ·{" "}
              👁 {(p.view_count ?? 0).toLocaleString()} views
            </p>
          </div>
          <Link to={`/blog/${p.slug}`}>
            <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
          </Link>
          <Link to={`/admin/blog/${p.id}`}>
            <Button variant="outline" size="sm"><Pencil className="h-4 w-4" /></Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-mono text-2xl font-bold tracking-wider">Manage Blog</h1>
        <Link to="/admin/blog/new">
          <Button size="sm" className="gap-1.5 font-mono">
            <Plus className="h-4 w-4" /> New Post
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <p className="font-mono text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Tabs defaultValue="drafts">
          <TabsList>
            <TabsTrigger value="drafts" className="font-mono">
              Drafts ({drafts.length})
            </TabsTrigger>
            <TabsTrigger value="published" className="font-mono">
              Published ({published.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="drafts" className="mt-4">{list(drafts)}</TabsContent>
          <TabsContent value="published" className="mt-4">{list(published)}</TabsContent>
        </Tabs>
      )}
    </div>
  );
}

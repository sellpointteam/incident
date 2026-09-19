import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BLOG_LIST_COLUMNS } from "@/lib/selectors";

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  published: boolean;
  published_at: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
  view_count?: number;
  category?: string | null;
  featured?: boolean | null;
  image_fit?: "contain" | "cover" | null;
  focal_x?: number | null;
  focal_y?: number | null;
  reading_time_minutes?: number | null;
}

// Lightweight list projection: excludes heavy `content` body and admin-only fields.
const BLOG_LIST_SELECT = `${BLOG_LIST_COLUMNS},view_count`;

export function usePublishedPosts() {
  return useQuery({
    queryKey: ["blog_posts", "published", "list"],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select(BLOG_LIST_SELECT)
        .eq("published", true)
        .order("published_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown) as BlogPost[];
    },
  });
}

/**
 * Posts visible on the public /blog page.
 * - Non-admin viewers: published only.
 * - Admin viewers: ALL posts; drafts first, then published, each by date desc.
 */
export function useViewablePosts(isAdmin: boolean) {
  return useQuery({
    queryKey: ["blog_posts", "viewable", "list", isAdmin ? "admin" : "public"],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!isAdmin) {
        const { data, error } = await supabase
          .from("blog_posts")
          .select(BLOG_LIST_SELECT)
          .eq("published", true)
          .order("published_at", { ascending: false });
        if (error) throw error;
        return ((data ?? []) as unknown) as BlogPost[];
      }
      const { data, error } = await supabase
        .from("blog_posts")
        .select(BLOG_LIST_SELECT)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const list = ((data ?? []) as unknown) as BlogPost[];
      return [...list.filter((p) => !p.published), ...list.filter((p) => p.published)];
    },
  });
}


export function usePostBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["blog_posts", "slug", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown) as BlogPost | null;
    },
  });
}

export function useAllPostsAdmin() {
  return useQuery({
    queryKey: ["blog_posts", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as BlogPost[];
    },
  });
}

export function usePostById(id: string | undefined) {
  return useQuery({
    queryKey: ["blog_posts", "id", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown) as BlogPost | null;
    },
  });
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

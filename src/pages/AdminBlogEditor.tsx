import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePostById, slugify } from "@/hooks/useBlog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered,
  Link as LinkIcon, Image as ImageIcon, Quote, Code, ArrowLeft, Eye,
} from "lucide-react";
import MarkdownContent from "@/components/MarkdownContent";
import ResponsiveArticleImage from "@/components/blog/ResponsiveArticleImage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const CATEGORY_OPTIONS = [
  "Operations",
  "Incident Analysis",
  "Group Profile",
  "Data Report",
  "Field Dispatch",
  "Commentary",
];

export default function AdminBlogEditor() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: existing, isLoading } = usePostById(isNew ? undefined : id);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [featured, setFeatured] = useState(false);
  const [imageFit, setImageFit] = useState<"contain" | "cover">("contain");
  const [focalX, setFocalX] = useState(50);
  const [focalY, setFocalY] = useState(50);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/login");
  }, [loading, user, isAdmin, navigate]);

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setSlug(existing.slug);
      setExcerpt(existing.excerpt ?? "");
      setContent(existing.content);
      setCoverUrl(existing.cover_image_url);
      setPublished(existing.published);
      setSlugTouched(true);
      setCategory(existing.category ?? "");
      setFeatured(!!existing.featured);
      setImageFit((existing.image_fit as "contain" | "cover") ?? "contain");
      setFocalX(existing.focal_x ?? 50);
      setFocalY(existing.focal_y ?? 50);
    }
  }, [existing]);

  useEffect(() => {
    if (!slugTouched && isNew) setSlug(slugify(title));
  }, [title, slugTouched, isNew]);

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop() || "png";
    const path = `${user?.id ?? "admin"}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("blog-images").upload(path, file);
    if (error) {
      toast.error(error.message);
      return null;
    }
    const { data } = supabase.storage.from("blog-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file);
    if (url) {
      setCoverUrl(url);
      toast.success("Cover image uploaded");
    }
    e.target.value = "";
  };

  const handleInsertImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file);
    if (url) insertAtCursor(`\n![${file.name}](${url})\n`);
    e.target.value = "";
  };

  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setContent((c) => c + text);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = content.slice(0, start) + text + content.slice(end);
    setContent(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  const wrapSelection = (before: string, after = before) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = content.slice(start, end) || "text";
    const next = content.slice(0, start) + before + sel + after + content.slice(end);
    setContent(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + sel.length);
    }, 0);
  };

  const insertLine = (prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = content.lastIndexOf("\n", start - 1) + 1;
    const next = content.slice(0, lineStart) + prefix + content.slice(lineStart);
    setContent(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  };

  const insertLink = () => {
    const url = prompt("Enter URL:");
    if (!url) return;
    wrapSelection("[", `](${url})`);
  };

  const save = async (publish: boolean | null = null) => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!slug.trim()) {
      toast.error("Slug is required");
      return;
    }
    setSaving(true);
    const willPublish = publish === null ? published : publish;
    // Preserve original publish date once set. Never null it out — even if
    // the post is later unpublished, we want to keep the original timestamp
    // so re-publishing doesn't reset it to "today".
    const preservedPublishedAt =
      existing?.published_at ?? (willPublish ? new Date().toISOString() : null);
    const payload = {
      title: title.trim(),
      slug: slug.trim(),
      excerpt: excerpt.trim() || null,
      content,
      cover_image_url: coverUrl,
      published: willPublish,
      published_at: preservedPublishedAt,
      author_id: user?.id ?? null,
      category: category || null,
      featured,
      image_fit: imageFit,
      focal_x: focalX,
      focal_y: focalY,
    } as never;

    if (isNew) {
      const { data, error } = await supabase
        .from("blog_posts")
        .insert(payload)
        .select()
        .single();
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success(willPublish ? "Published" : "Draft saved");
      qc.invalidateQueries({ queryKey: ["blog_posts"] });
      navigate(`/admin/blog/${data.id}`);
    } else {
      const { error } = await supabase.from("blog_posts").update(payload).eq("id", id!);
      setSaving(false);
      if (error) return toast.error(error.message);
      setPublished(willPublish);
      toast.success(willPublish ? "Published" : "Saved");
      qc.invalidateQueries({ queryKey: ["blog_posts"] });
    }
  };

  if (loading || (!isNew && isLoading)) {
    return <div className="container mx-auto max-w-4xl px-4 py-8 font-mono text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Link to="/admin/blog" className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-3 w-3" /> Back to posts
      </Link>

      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <h1 className="font-mono text-2xl font-bold tracking-wider">
          {isNew ? "New Post" : "Edit Post"}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPreview((v) => !v)} className="gap-1.5 font-mono">
            <Eye className="h-4 w-4" /> {showPreview ? "Edit" : "Preview"}
          </Button>
          <Button variant="outline" size="sm" disabled={saving} onClick={() => save(false)} className="font-mono">
            Save Draft
          </Button>
          <Button size="sm" disabled={saving} onClick={() => save(true)} className="font-mono">
            {published ? "Update" : "Publish"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        <div>
          <Label className="font-mono text-xs">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title" />
        </div>

        <div>
          <Label className="font-mono text-xs">Slug</Label>
          <Input
            value={slug}
            onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
            placeholder="url-slug"
          />
          <p className="font-mono text-[11px] text-muted-foreground mt-1">/blog/{slug || "..."}</p>
        </div>

        <div>
          <Label className="font-mono text-xs">Excerpt (optional)</Label>
          <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} placeholder="Short summary shown on the blog list" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="font-mono text-xs">Category</Label>
            <Select value={category || "none"} onValueChange={(v) => setCategory(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="No category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end justify-between rounded-md border border-border/60 bg-card/40 px-3 py-2">
            <div>
              <Label className="font-mono text-xs">Featured</Label>
              <p className="text-[11px] text-muted-foreground">Pin this article to the top of the blog page.</p>
            </div>
            <Switch checked={featured} onCheckedChange={setFeatured} />
          </div>
        </div>

        <div>
          <Label className="font-mono text-xs">Cover Image</Label>
          <div className="mt-2 grid gap-3 md:grid-cols-[1fr,280px]">
            <div className="rounded-lg border border-border/60 bg-card/40 p-2">
              <ResponsiveArticleImage
                src={coverUrl}
                alt="cover preview"
                imageFit={imageFit}
                focalX={focalX}
                focalY={focalY}
                aspect="16 / 9"
              />
            </div>
            <div className="flex flex-col gap-3">
              <input type="file" accept="image/*" onChange={handleCoverUpload} className="font-mono text-xs" />
              {coverUrl && (
                <Button variant="ghost" size="sm" onClick={() => setCoverUrl(null)} className="font-mono text-xs self-start">
                  Remove image
                </Button>
              )}
              <div>
                <Label className="font-mono text-xs">Display mode</Label>
                <Select value={imageFit} onValueChange={(v) => setImageFit(v as "contain" | "cover")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contain">Fit entire image</SelectItem>
                    <SelectItem value="cover">Fill frame</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Fit entire image prevents cropping. Fill frame may crop the edges.
                </p>
              </div>
              {imageFit === "cover" && (
                <div>
                  <Label className="font-mono text-xs">Focal point</Label>
                  <Select
                    value={`${focalX}-${focalY}`}
                    onValueChange={(v) => {
                      const [x, y] = v.split("-").map(Number);
                      setFocalX(x); setFocalY(y);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50-50">Center</SelectItem>
                      <SelectItem value="50-0">Top</SelectItem>
                      <SelectItem value="50-100">Bottom</SelectItem>
                      <SelectItem value="0-50">Left</SelectItem>
                      <SelectItem value="100-50">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <Label className="font-mono text-xs">Content (Markdown)</Label>
          {!showPreview ? (
            <>
              <Card className="p-2 mt-1 flex flex-wrap gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => insertLine("# ")} title="H1"><Heading1 className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => insertLine("## ")} title="H2"><Heading2 className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => insertLine("### ")} title="H3"><Heading3 className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => wrapSelection("**")} title="Bold"><Bold className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => wrapSelection("*")} title="Italic"><Italic className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => insertLine("- ")} title="Bullet list"><List className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => insertLine("1. ")} title="Numbered list"><ListOrdered className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => insertLine("> ")} title="Quote"><Quote className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => wrapSelection("`")} title="Inline code"><Code className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="sm" onClick={insertLink} title="Link"><LinkIcon className="h-4 w-4" /></Button>
                <label className="inline-flex items-center cursor-pointer">
                  <span className="inline-flex items-center justify-center h-9 px-3 rounded-md hover:bg-accent">
                    <ImageIcon className="h-4 w-4" />
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleInsertImage} />
                </label>
              </Card>
              <Textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={20}
                className="font-mono text-sm mt-2"
                placeholder="Write your post in Markdown…"
              />
            </>
          ) : (
            <Card className="p-6 mt-1">
              <MarkdownContent content={content || "*Nothing to preview*"} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

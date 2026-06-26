import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import slugify from "slugify";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Upload } from "lucide-react";
import { RichTextEditor } from "@/components/blog/RichTextEditor";
import { usePostByIdAdmin, readingTimeMinutes, getSignedCoverUrl } from "@/hooks/useBlogPosts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const CATEGORIES = [
  "Market Trends",
  "Mortgage & Rates",
  "Buying Guide",
  "Investing",
  "Neighborhoods",
  "Policy & Regulation",
];

export default function BlogEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: post } = usePostByIdAdmin(id);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState<string>("Market Trends");
  const [tags, setTags] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiLength, setAiLength] = useState<"short" | "medium" | "long">("medium");
  const [aiBusy, setAiBusy] = useState(false);

  // Hydrate from loaded post
  useEffect(() => {
    if (!post) return;
    setTitle(post.title);
    setSlug(post.slug);
    setSlugTouched(true);
    setExcerpt(post.excerpt ?? "");
    setCategory(post.category ?? "Market Trends");
    setTags((post.tags ?? []).join(", "));
    setBodyHtml(post.body_html ?? "");
    setCoverPath(post.cover_image_url);
    setStatus(post.status);
    setSeoTitle(post.seo_title ?? "");
    setSeoDescription(post.seo_description ?? "");
    if (post.cover_image_url) getSignedCoverUrl(post.cover_image_url).then(setCoverPreview);
  }, [post]);

  // Auto-slug from title for new posts
  useEffect(() => {
    if (!slugTouched && title) {
      setSlug(slugify(title, { lower: true, strict: true }).slice(0, 80));
    }
  }, [title, slugTouched]);

  const handleCoverUpload = async (file: File) => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("blog-covers").upload(path, file, { upsert: false });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      return;
    }
    setCoverPath(path);
    const signed = await getSignedCoverUrl(path);
    setCoverPreview(signed);
    toast({ title: "Cover uploaded" });
  };

  const handleGenerateDraft = async () => {
    if (!aiTopic.trim()) {
      toast({ title: "Add a topic", description: "Tell the AI what to write about.", variant: "destructive" });
      return;
    }
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("blog-draft-generate", {
        body: { action: "draft", topic: aiTopic, length: aiLength },
      });
      if (error) throw error;
      const d = data?.draft;
      if (!d) throw new Error("AI returned no draft");
      setTitle(d.title || "");
      setExcerpt(d.excerpt || "");
      setCategory(d.category && CATEGORIES.includes(d.category) ? d.category : "Market Trends");
      setTags(Array.isArray(d.tags) ? d.tags.join(", ") : "");
      setBodyHtml(d.body_html || "");
      setSeoTitle(d.seo_title || "");
      setSeoDescription(d.seo_description || "");
      setAiOpen(false);
      toast({ title: "Draft generated", description: "Review and edit before publishing." });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setAiBusy(false);
    }
  };

  const handleSave = async (publish?: boolean) => {
    if (!title || !slug) {
      toast({ title: "Missing fields", description: "Title and slug are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const nextStatus = publish === true ? "published" : publish === false ? "draft" : status;
    const tagArr = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const payload: any = {
      title,
      slug,
      excerpt: excerpt || null,
      cover_image_url: coverPath,
      body_html: bodyHtml,
      category,
      tags: tagArr,
      status: nextStatus,
      seo_title: seoTitle || null,
      seo_description: seoDescription || null,
      reading_time_minutes: readingTimeMinutes(bodyHtml),
    };
    if (nextStatus === "published") payload.published_at = post?.published_at ?? new Date().toISOString();

    try {
      if (isNew) {
        const { data: { session } } = await supabase.auth.getSession();
        payload.author_id = session?.user?.id ?? null;
        const { data, error } = await supabase.from("blog_posts").insert(payload).select("id").single();
        if (error) throw error;
        toast({ title: "Post created" });
        qc.invalidateQueries({ queryKey: ["blog"] });
        navigate(`/admin/blog/${data.id}/edit`, { replace: true });
      } else {
        const { error } = await supabase.from("blog_posts").update(payload).eq("id", id!);
        if (error) throw error;
        setStatus(nextStatus);
        toast({ title: nextStatus === "published" ? "Published" : "Saved" });
        qc.invalidateQueries({ queryKey: ["blog"] });
      }
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <main className="flex-1 container max-w-4xl mx-auto px-4 pt-24 pb-16">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">{isNew ? "New post" : "Edit post"}</h1>
            <p className="text-sm text-muted-foreground">Status: {status}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAiOpen((v) => !v)}>
              <Sparkles className="h-4 w-4 mr-2" />Generate draft with AI
            </Button>
            <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>Save as draft</Button>
            <Button onClick={() => handleSave(true)} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {status === "published" ? "Update published" : "Publish"}
            </Button>
          </div>
        </div>

        {aiOpen && (
          <Card className="mb-6 border-primary/40">
            <CardHeader><CardTitle className="text-lg">AI-assisted draft</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Topic, e.g. 'Q3 2026 Austin housing market: prices, inventory, and what it means for buyers.'"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                rows={3}
              />
              <div className="flex items-center gap-3 flex-wrap">
                <Label className="text-sm">Length:</Label>
                <Select value={aiLength} onValueChange={(v: any) => setAiLength(v)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short (~500w)</SelectItem>
                    <SelectItem value="medium">Medium (~850w)</SelectItem>
                    <SelectItem value="long">Long (~1500w)</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleGenerateDraft} disabled={aiBusy}>
                  {aiBusy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Writing…</> : "Generate"}
                </Button>
                <p className="text-xs text-muted-foreground">Generated content overwrites the editor. Save first if you have unsaved edits.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} />
              <p className="text-xs text-muted-foreground">URL: /blog/{slug || "your-slug"}</p>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt">Excerpt (150-160 chars)</Label>
            <Textarea id="excerpt" rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Cover image</Label>
            {coverPreview && (
              <div className="aspect-[16/9] overflow-hidden rounded-md bg-muted max-w-md">
                <img src={coverPreview} alt="cover" className="h-full w-full object-cover" />
              </div>
            )}
            <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-accent text-sm">
              <Upload className="h-4 w-4" />
              {coverPreview ? "Replace cover" : "Upload cover"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); }}
              />
            </label>
          </div>

          <div className="space-y-2">
            <Label>Body</Label>
            <RichTextEditor value={bodyHtml} onChange={setBodyHtml} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="austin, market-update, 2026" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="seo-title">SEO title (optional)</Label>
              <Input id="seo-title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={70} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seo-desc">SEO description (optional)</Label>
              <Input id="seo-desc" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} maxLength={170} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

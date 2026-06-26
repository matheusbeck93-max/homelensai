import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  body_html: string;
  category: string | null;
  tags: string[];
  status: "draft" | "published";
  published_at: string | null;
  author_id: string | null;
  seo_title: string | null;
  seo_description: string | null;
  reading_time_minutes: number | null;
  created_at: string;
  updated_at: string;
};

export function usePublishedPosts() {
  return useQuery({
    queryKey: ["blog", "published"],
    queryFn: async (): Promise<BlogPost[]> => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BlogPost[];
    },
  });
}

export function usePostBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["blog", "slug", slug],
    queryFn: async (): Promise<BlogPost | null> => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return (data as BlogPost) ?? null;
    },
    enabled: !!slug,
  });
}

export function useAllPostsAdmin(enabled: boolean) {
  return useQuery({
    queryKey: ["blog", "admin", "all"],
    queryFn: async (): Promise<BlogPost[]> => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BlogPost[];
    },
    enabled,
  });
}

export function usePostByIdAdmin(id: string | undefined) {
  return useQuery({
    queryKey: ["blog", "admin", "id", id],
    queryFn: async (): Promise<BlogPost | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as BlogPost) ?? null;
    },
    enabled: !!id,
  });
}

export async function getSignedCoverUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const { data, error } = await supabase
    .storage
    .from("blog-covers")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (error) return null;
  return data.signedUrl;
}

export function readingTimeMinutes(html: string): number {
  const words = html.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

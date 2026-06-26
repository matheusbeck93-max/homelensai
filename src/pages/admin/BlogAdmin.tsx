import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { useAllPostsAdmin } from "@/hooks/useBlogPosts";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function BlogAdmin() {
  const [ready, setReady] = useState(false);
  const { data: posts = [], isLoading, refetch } = useAllPostsAdmin(ready);
  const qc = useQueryClient();
  const { toast } = useToast();

  useEffect(() => { setReady(true); }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Post deleted" });
    qc.invalidateQueries({ queryKey: ["blog"] });
    refetch();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <main className="flex-1 container max-w-5xl mx-auto px-4 pt-24 pb-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Blog admin</h1>
            <p className="text-muted-foreground">Manage HomeLens blog posts.</p>
          </div>
          <Button asChild>
            <Link to="/admin/blog/new"><Plus className="h-4 w-4 mr-2" />New post</Link>
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : posts.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            No posts yet. Click <strong>New post</strong> to write your first one.
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {posts.map((p) => (
              <Card key={p.id}>
                <CardContent className="py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={p.status === "published" ? "default" : "secondary"}>{p.status}</Badge>
                      {p.category && <Badge variant="outline">{p.category}</Badge>}
                      <span className="text-xs text-muted-foreground">
                        Updated {new Date(p.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-semibold truncate">{p.title}</h3>
                    <p className="text-sm text-muted-foreground truncate">/{p.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.status === "published" && (
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/blog/${p.slug}`} target="_blank"><ExternalLink className="h-4 w-4" /></Link>
                      </Button>
                    )}
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/admin/blog/${p.id}/edit`}><Pencil className="h-4 w-4 mr-1" />Edit</Link>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id, p.title)} aria-label="Delete post">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/blog/PostCard";
import { usePublishedPosts } from "@/hooks/useBlogPosts";

export default function Blog() {
  const { data: posts = [], isLoading } = usePublishedPosts();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => p.category && set.add(p.category));
    return Array.from(set).sort();
  }, [posts]);

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (category && p.category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        return p.title.toLowerCase().includes(q) || (p.excerpt ?? "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [posts, category, search]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>Blog — US Real Estate News & Insights | HomeLens</title>
        <meta name="description" content="HomeLens Blog — market trends, mortgage rates, buying guides, and US real estate analysis from our team." />
        <link rel="canonical" href="https://homelensais.com/blog" />
        <meta property="og:title" content="HomeLens Blog — US Real Estate News & Insights" />
        <meta property="og:description" content="Market trends, mortgage rates, buying guides, and US real estate analysis." />
        <meta property="og:url" content="https://homelensais.com/blog" />
        <meta property="og:type" content="website" />
      </Helmet>

      <Navigation />

      <main className="flex-1 container max-w-6xl mx-auto px-4 pt-24 pb-16">
        <header className="mb-10 max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">HomeLens Blog</h1>
          <p className="text-lg text-muted-foreground">
            US real estate news, market data, and decision-making insights for buyers and investors.
          </p>
        </header>

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <Input
            placeholder="Search posts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={category === null ? "default" : "outline"}
              onClick={() => setCategory(null)}
            >
              All
            </Button>
            {categories.map((c) => (
              <Button key={c} size="sm" variant={category === c ? "default" : "outline"} onClick={() => setCategory(c)}>
                {c}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading posts…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>No posts match your search. Try a different keyword or category.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Featured = newest, only when not filtering */}
            {!search && !category && filtered[0] && (
              <PostCard post={filtered[0]} variant="featured" />
            )}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {(!search && !category ? filtered.slice(1) : filtered).map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

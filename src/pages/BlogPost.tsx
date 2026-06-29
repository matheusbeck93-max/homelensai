import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { usePostBySlug, getSignedCoverUrl, usePublishedPosts } from "@/hooks/useBlogPosts";
import { PostCard } from "@/components/blog/PostCard";
import { ShareButtonArticle } from "@/components/blog/ShareButtonArticle";

const SITE = "https://homelensais.com";

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading } = usePostBySlug(slug);
  const { data: allPosts = [] } = usePublishedPosts();
  const [cover, setCover] = useState<string | null>(null);

  useEffect(() => {
    if (post?.cover_image_url) getSignedCoverUrl(post.cover_image_url).then(setCover);
  }, [post?.cover_image_url]);

  const related = useMemo(() => {
    if (!post) return [];
    return allPosts
      .filter((p) => p.id !== post.id && (post.category ? p.category === post.category : true))
      .slice(0, 3);
  }, [allPosts, post]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 container max-w-3xl mx-auto px-4 pt-24 pb-16">
          <p className="text-muted-foreground">Loading…</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!post || post.status !== "published") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 container max-w-3xl mx-auto px-4 pt-24 pb-16">
          <h1 className="text-3xl font-bold mb-3">Post not found</h1>
          <p className="text-muted-foreground mb-6">This post may have been moved or unpublished.</p>
          <Button asChild><Link to="/blog">Back to blog</Link></Button>
        </main>
        <Footer />
      </div>
    );
  }

  const url = `${SITE}/blog/${post.slug}`;
  const title = post.seo_title || post.title;
  const description = post.seo_description || post.excerpt || `${post.title} — HomeLens Blog`;
  const date = post.published_at ? new Date(post.published_at) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description,
    image: cover ? [cover] : undefined,
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Organization", name: "HomeLens" },
    publisher: { "@type": "Organization", name: "HomeLens", url: SITE },
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        {cover && <meta property="og:image" content={cover} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        {cover && <meta name="twitter:image" content={cover} />}
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <Navigation />

      <main className="flex-1 container max-w-3xl mx-auto px-4 pt-24 pb-16">
        <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to blog
        </Link>

        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-4">
            {post.category && <Badge variant="secondary">{post.category}</Badge>}
            {date && <span>{date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>}
            {post.reading_time_minutes && <span>· {post.reading_time_minutes} min read</span>}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold leading-[1.1] tracking-tight">{post.title}</h1>
          {post.excerpt && <p className="mt-5 text-lg sm:text-xl text-muted-foreground leading-relaxed">{post.excerpt}</p>}
        </header>

        {cover && (
          <div className="aspect-[16/9] overflow-hidden rounded-xl border border-border/60 bg-muted mb-10 shadow-sm">
            <img src={cover} alt={post.title} className="h-full w-full object-cover" />
          </div>
        )}

        <article
          className="prose prose-neutral dark:prose-invert prose-lg max-w-none
            prose-headings:tracking-tight prose-headings:font-bold
            prose-h2:mt-12 prose-h2:mb-4 prose-h2:text-3xl
            prose-h3:mt-8 prose-h3:mb-3 prose-h3:text-xl
            prose-p:leading-relaxed
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-muted/40 prose-blockquote:rounded-r-md prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:not-italic
            prose-img:rounded-lg prose-img:border prose-img:border-border/60
            prose-figure:my-8
            prose-figcaption:text-center prose-figcaption:text-sm prose-figcaption:text-muted-foreground prose-figcaption:mt-2
            prose-ul:my-4 prose-li:my-1
            prose-strong:text-foreground"
          dangerouslySetInnerHTML={{ __html: post.body_html }}
        />

        {post.tags?.length > 0 && (
          <div className="mt-12 pt-6 border-t flex flex-wrap gap-2">
            {post.tags.map((t) => <Badge key={t} variant="outline">#{t}</Badge>)}
          </div>
        )}

        {related.length > 0 && (
          <section className="mt-16 pt-10 border-t">
            <h2 className="text-2xl font-bold tracking-tight mb-6">Keep reading</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => <PostCard key={p.id} post={p} />)}
            </div>
          </section>
        )}

        <div className="mt-12">
          <Button asChild variant="outline">
            <Link to="/blog"><ArrowLeft className="h-4 w-4 mr-2" /> All posts</Link>
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
}

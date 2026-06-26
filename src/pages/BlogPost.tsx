import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { usePostBySlug, getSignedCoverUrl } from "@/hooks/useBlogPosts";

const SITE = "https://homelensais.com";

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading } = usePostBySlug(slug);
  const [cover, setCover] = useState<string | null>(null);

  useEffect(() => {
    if (post?.cover_image_url) getSignedCoverUrl(post.cover_image_url).then(setCover);
  }, [post?.cover_image_url]);

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
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            {post.category && <Badge variant="secondary">{post.category}</Badge>}
            {date && <span>{date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>}
            {post.reading_time_minutes && <span>· {post.reading_time_minutes} min read</span>}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight">{post.title}</h1>
          {post.excerpt && <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p>}
        </header>

        {cover && (
          <div className="aspect-[16/9] overflow-hidden rounded-lg bg-muted mb-8">
            <img src={cover} alt={post.title} className="h-full w-full object-cover" />
          </div>
        )}

        <article
          className="prose prose-neutral dark:prose-invert prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: post.body_html }}
        />

        {post.tags?.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2">
            {post.tags.map((t) => <Badge key={t} variant="outline">#{t}</Badge>)}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

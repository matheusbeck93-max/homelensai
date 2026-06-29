import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BlogPost, getSignedCoverUrl } from "@/hooks/useBlogPosts";

type Variant = "default" | "featured" | "compact";

export function PostCard({ post, variant = "default" }: { post: BlogPost; variant?: Variant }) {
  const [cover, setCover] = useState<string | null>(null);
  useEffect(() => {
    getSignedCoverUrl(post.cover_image_url).then(setCover);
  }, [post.cover_image_url]);

  const date = post.published_at ? new Date(post.published_at) : null;
  const dateLabel = date
    ? date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : null;

  if (variant === "featured") {
    return (
      <Link to={`/blog/${post.slug}`} className="group block">
        <Card className="overflow-hidden border-border/60 transition-shadow hover:shadow-lg">
          <div className="grid md:grid-cols-2">
            <div className="aspect-[16/10] md:aspect-auto md:h-full overflow-hidden bg-muted">
              {cover && (
                <img
                  src={cover}
                  alt={post.title}
                  loading="eager"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              )}
            </div>
            <CardContent className="p-6 sm:p-8 flex flex-col justify-center gap-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge>Featured</Badge>
                {post.category && <Badge variant="secondary">{post.category}</Badge>}
                {dateLabel && <span>{dateLabel}</span>}
                {post.reading_time_minutes && <span>· {post.reading_time_minutes} min read</span>}
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold leading-tight tracking-tight group-hover:text-primary transition-colors">
                {post.title}
              </h2>
              {post.excerpt && <p className="text-muted-foreground line-clamp-4">{post.excerpt}</p>}
              <span className="text-sm font-medium text-primary">Read article →</span>
            </CardContent>
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <Link to={`/blog/${post.slug}`} className="group block">
      <Card className="overflow-hidden h-full border-border/60 transition-shadow hover:shadow-md flex flex-col">
        <div className="aspect-[16/9] overflow-hidden bg-muted">
          {cover && (
            <img
              src={cover}
              alt={post.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}
        </div>
        <CardContent className="p-5 space-y-3 flex-1 flex flex-col">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {post.category && <Badge variant="secondary">{post.category}</Badge>}
            {dateLabel && <span>{dateLabel}</span>}
            {post.reading_time_minutes && <span>· {post.reading_time_minutes} min read</span>}
          </div>
          <h3 className="text-lg font-semibold leading-snug tracking-tight group-hover:text-primary transition-colors">
            {post.title}
          </h3>
          {post.excerpt && <p className="text-sm text-muted-foreground line-clamp-3 flex-1">{post.excerpt}</p>}
          <span className="text-sm font-medium text-primary mt-auto">Read →</span>
        </CardContent>
      </Card>
    </Link>
  );
}

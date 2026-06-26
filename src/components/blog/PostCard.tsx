import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BlogPost, getSignedCoverUrl } from "@/hooks/useBlogPosts";

export function PostCard({ post }: { post: BlogPost }) {
  const [cover, setCover] = useState<string | null>(null);
  useEffect(() => {
    getSignedCoverUrl(post.cover_image_url).then(setCover);
  }, [post.cover_image_url]);

  const date = post.published_at ? new Date(post.published_at) : null;

  return (
    <Link to={`/blog/${post.slug}`} className="group block">
      <Card className="overflow-hidden h-full transition-shadow hover:shadow-md">
        {cover && (
          <div className="aspect-[16/9] overflow-hidden bg-muted">
            <img
              src={cover}
              alt={post.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        )}
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {post.category && <Badge variant="secondary">{post.category}</Badge>}
            {date && <span>{date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>}
            {post.reading_time_minutes && <span>· {post.reading_time_minutes} min read</span>}
          </div>
          <h3 className="text-xl font-semibold leading-tight group-hover:text-primary transition-colors">{post.title}</h3>
          {post.excerpt && <p className="text-sm text-muted-foreground line-clamp-3">{post.excerpt}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

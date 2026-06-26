import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/blog/PostCard";
import { usePublishedPosts } from "@/hooks/useBlogPosts";

export function HomepageBlogSection() {
  const { data: posts = [] } = usePublishedPosts();
  const latest = posts.slice(0, 3);

  if (latest.length === 0) return null;

  return (
    <section id="blog" className="py-16 sm:py-24 px-4 bg-muted/30 border-t scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10"
        >
          <div>
            <div className="inline-flex items-center gap-2 text-sm text-primary mb-2">
              <BookOpen className="h-4 w-4" />
              <span>From the HomeLens Blog</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              US real estate news & insights
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Market trends, mortgage rates, neighborhood breakdowns, and buying guides — written and curated by the HomeLens team.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/blog">
              View all posts <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {latest.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      </div>
    </section>
  );
}

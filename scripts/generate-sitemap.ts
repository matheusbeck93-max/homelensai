// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes public/sitemap.xml.
// Pulls published blog posts from Supabase via the public REST API so new posts
// surface in the sitemap automatically.

import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://homelensais.com";
const SUPABASE_URL = "https://yckcdxtatwolzilboahx.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlja2NkeHRhdHdvbHppbGJvYWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMDk3MTEsImV4cCI6MjA3Njg4NTcxMX0.MyOrW96L1QrSXoHaeU-XcR35-YEeqxKLxxc2pZJYww4";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  // Feature pages
  { path: "/features/chrome-extension", changefreq: "monthly", priority: "0.8" },
  { path: "/features/ai-chat", changefreq: "monthly", priority: "0.8" },
  { path: "/features/buying-power", changefreq: "monthly", priority: "0.8" },
  { path: "/features/investor-brief", changefreq: "monthly", priority: "0.8" },
  { path: "/features/investor-calculator", changefreq: "monthly", priority: "0.8" },
  { path: "/features/brrrr-calculator", changefreq: "monthly", priority: "0.8" },
  { path: "/features/saved-analyses", changefreq: "monthly", priority: "0.8" },
  { path: "/features/my-properties", changefreq: "monthly", priority: "0.8" },
  { path: "/features/preferences", changefreq: "monthly", priority: "0.8" },
  { path: "/features/property-analysis", changefreq: "monthly", priority: "0.8" },
  // Solution pages
  { path: "/solutions/buyer", changefreq: "monthly", priority: "0.8" },
  { path: "/solutions/investor", changefreq: "monthly", priority: "0.8" },
  { path: "/faq", changefreq: "monthly", priority: "0.6" },
  { path: "/blog", changefreq: "weekly", priority: "0.8" },
  { path: "/calculators", changefreq: "monthly", priority: "0.8" },
  { path: "/calculators/brrrr", changefreq: "monthly", priority: "0.7" },
  { path: "/investor", changefreq: "monthly", priority: "0.8" },
  { path: "/investor/properties", changefreq: "monthly", priority: "0.6" },
  { path: "/investor/calculator", changefreq: "monthly", priority: "0.6" },
  { path: "/chats", changefreq: "weekly", priority: "0.6" },
  { path: "/console", changefreq: "weekly", priority: "0.6" },
  { path: "/pricing", changefreq: "monthly", priority: "0.8" },
  { path: "/compare", changefreq: "monthly", priority: "0.6" },
  { path: "/auth", changefreq: "yearly", priority: "0.4" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/extension-privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/cookies", changefreq: "yearly", priority: "0.3" },
  { path: "/accessibility", changefreq: "yearly", priority: "0.3" },
  { path: "/fair-housing", changefreq: "yearly", priority: "0.3" },
  { path: "/ccpa", changefreq: "yearly", priority: "0.3" },
  { path: "/dmca", changefreq: "yearly", priority: "0.3" },
  { path: "/do-not-sell", changefreq: "yearly", priority: "0.3" },
];

async function fetchBlogEntries(): Promise<SitemapEntry[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/blog_posts?select=slug,updated_at&status=eq.published&order=published_at.desc`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
    );
    if (!res.ok) {
      console.warn(`[sitemap] could not fetch blog posts (HTTP ${res.status})`);
      return [];
    }
    const rows = (await res.json()) as Array<{ slug: string; updated_at: string }>;
    return rows.map((r) => ({
      path: `/blog/${r.slug}`,
      lastmod: r.updated_at?.slice(0, 10),
      changefreq: "monthly",
      priority: "0.7",
    }));
  } catch (err) {
    console.warn(`[sitemap] could not fetch blog posts:`, err);
    return [];
  }
}

function renderSitemap(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

async function main() {
  const blog = await fetchBlogEntries();
  const entries = [...staticEntries, ...blog];
  writeFileSync(resolve("public/sitemap.xml"), renderSitemap(entries));
  console.log(`sitemap.xml written (${entries.length} entries — ${blog.length} blog posts)`);
}

main();

# Blog feature with AI-assisted authoring

Self-serve blog you can publish to from inside the app, with a dedicated index at `/blog`, individual post pages, and a "Blog" entry in the homepage header (next to Extension, Investors, Chat, Pricing, FAQ). The homepage section is minimal — a heading + CTA pointing to `/blog`.

## What you get

- **Homepage section** (`#blog`): short heading "From the HomeLens blog — US real estate news & insights" + a "Read the blog" button to `/blog`. URL `/blog-section` (or `/blog#blog`) added to the header section nav.
- **Header icon**: "Blog" added to `HOMEPAGE_SECTIONS` (logged-out homepage visitors only, matching the existing pattern).
- **`/blog`**: Public archive page listing all published posts (newest first), cover image, title, excerpt, category tag, date, reading time. Category filter + search.
- **`/blog/:slug`**: Public post page with cover image, title, author, date, full HTML content, related posts, SEO metadata (title, description, canonical, OG/Twitter), and `BlogPosting` JSON-LD.
- **`/admin/blog`**: Staff-only dashboard listing all posts (draft + published) with edit/delete/publish actions.
- **`/admin/blog/new` and `/admin/blog/:id/edit`**: Editor with:
  - Title, slug (auto-generated, editable), excerpt, category, tags, cover image upload, status (draft / published), publish date, SEO title/description override.
  - **Rich text editor** (Tiptap) for the body.
  - **"Generate draft with AI" button**: prompts you for a topic, calls a new edge function `blog-draft-generate` that uses Gemini via Lovable AI Gateway to produce a structured draft (title, excerpt, body in HTML, suggested category & tags) constrained to US real estate. You then edit before publishing.
  - **"Improve this section" / "Suggest title" / "Generate excerpt"** inline AI helpers.
- **Sitemap**: `public/sitemap.xml` is static today; a new `blog-sitemap` edge function will dynamically serve `/blog-sitemap.xml` listing all published posts; the static sitemap gets `/blog` + a `<sitemap>` reference. (Or we extend the static one and regenerate on publish — see Technical.)
- **SEO**: H1 on post pages, canonical, OG image (cover), `BlogPosting` JSON-LD with author/date/image, breadcrumb JSON-LD.

## Authoring flow (your day-to-day)

1. Sign in as a staff user (your existing `profiles.is_staff` flag).
2. Go to `/admin/blog` → "New post".
3. Click "Generate draft with AI", give it a topic like "Q3 2026 Austin housing market update".
4. AI returns a structured draft → you edit in the rich editor, add a cover image, set category.
5. Toggle status to "Published" → save. Post is live at `/blog/your-slug` immediately and added to sitemap.

No need to send posts to me ever — you publish independently.

## Technical details

**Database (one migration):**
- `blog_posts` table: `id uuid pk`, `slug text unique not null`, `title text`, `excerpt text`, `cover_image_url text`, `body_html text`, `category text`, `tags text[]`, `status text check in ('draft','published')`, `published_at timestamptz`, `author_id uuid references auth.users(id)`, `seo_title text`, `seo_description text`, `reading_time_minutes int`, `created_at`, `updated_at`.
- GRANTs: `SELECT` to `anon` and `authenticated` (only via RLS filter `status = 'published'`); full CRUD to `authenticated` but gated by `is_staff` RLS; `ALL` to `service_role`.
- RLS policies:
  - Public read: `status = 'published'` for `anon` + `authenticated`.
  - Staff full read/write: `EXISTS (select 1 from profiles where id = auth.uid() and is_staff = true)`.
- Trigger: `update_updated_at_column` on update.
- Storage bucket: new public bucket `blog-covers` for cover images (staff-only write via RLS, public read).

**Edge functions:**
- `blog-draft-generate`: takes `{ topic, tone?, length? }`, calls Gemini via Lovable AI Gateway with a US-real-estate-scoped system prompt + structured output (Zod schema → `{ title, excerpt, body_html, category, tags[], seo_title, seo_description }`). Staff-only (verify JWT + `is_staff`).
- `blog-ai-helper`: shared endpoint for inline helpers (`action: 'improve' | 'title' | 'excerpt'`, `text`). Staff-only.
- `blog-sitemap`: returns `application/xml` listing all published posts (cached 5 min). Wired through `vite.config.ts` rewrite or served at `/functions/v1/blog-sitemap` and referenced from the main sitemap index.

**Frontend files:**
- New routes in `src/App.tsx`: `/blog`, `/blog/:slug`, `/admin/blog`, `/admin/blog/new`, `/admin/blog/:id/edit`. Admin routes wrapped in `<StaffRoute />` (new — mirrors `ProtectedRoute` but also requires `profiles.is_staff`).
- New pages: `src/pages/Blog.tsx`, `src/pages/BlogPost.tsx`, `src/pages/admin/BlogAdmin.tsx`, `src/pages/admin/BlogEditor.tsx`.
- New components: `src/components/blog/PostCard.tsx`, `src/components/blog/RichTextEditor.tsx` (Tiptap wrapper), `src/components/blog/AIDraftDialog.tsx`, `src/components/blog/CoverImageUpload.tsx`.
- Homepage: add `<section id="blog">` in `src/pages/Index.tsx` (compact CTA only).
- `src/components/HomepageSectionNav.tsx`: add `{ id: "blog", label: "Blog", path: "/blog-section" }` (or reuse `/blog`).
- New hook: `src/hooks/useBlogPosts.ts` (list + single).

**Deps to add:** `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-image`, `slugify`, `reading-time`.

**Out of scope (can add later):** comments, post reactions, email-newsletter on publish, multi-author bios, scheduled publishing, drafts collaboration, RSS feed (easy follow-up if you want it).

## Verification before sign-off

- Create a draft via AI generator, edit, publish — confirm visible at `/blog` and `/blog/:slug` while signed out.
- Confirm `<title>`, meta description, canonical, OG tags, and `BlogPosting` JSON-LD on a post.
- Confirm "Blog" link in homepage header for logged-out visitors only.
- Confirm non-staff users get 404/redirect on `/admin/blog`.
- Confirm `/blog-sitemap.xml` lists the new post.

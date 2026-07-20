UPDATE public.blog_posts
SET body_html = REPLACE(
  body_html,
  '/__l5e/assets-v1/769cce94-c965-4a5f-9fc4-19242ba333ae/article07-tax.jpg',
  '/__l5e/assets-v1/84cbe178-97a6-4a59-9bc2-11ed8b8b13ac/article07-tax-v2.jpg'
)
WHERE slug = 'what-home-listing-doesnt-tell-you';
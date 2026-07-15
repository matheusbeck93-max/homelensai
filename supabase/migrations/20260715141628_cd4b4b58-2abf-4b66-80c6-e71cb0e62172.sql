UPDATE public.blog_posts SET body_html = replace(body_html,
  '<h2>School Quality — The Signal With the Biggest Price Tag</h2>',
  '<h2>School Quality — The Signal With the Biggest Price Tag</h2>
<figure><img src="/__l5e/assets-v1/119777bf-f6c4-40c7-9067-8bdec52bd594/blog-nb-schools.jpg" alt="Families walking to a suburban elementary school on a tree-lined sidewalk" loading="lazy" /><figcaption>Strong school attendance zones carry the largest measurable price premium of any neighborhood factor.</figcaption></figure>'
) WHERE slug = 'how-to-evaluate-neighborhood-before-buying';

UPDATE public.blog_posts SET body_html = replace(body_html,
  '<h2>Safety and Crime Data — How to Read It Without Being Misled</h2>',
  '<h2>Safety and Crime Data — How to Read It Without Being Misled</h2>
<figure><img src="/__l5e/assets-v1/a54bc654-6c86-4ae6-8343-91bced5b2e67/blog-nb-safety.jpg" alt="A quiet residential street at dusk with warm streetlights and a couple walking a dog" loading="lazy" /><figcaption>Perceived safety at night — lighting, foot traffic, upkeep — often tells you more than a single crime statistic.</figcaption></figure>'
) WHERE slug = 'how-to-evaluate-neighborhood-before-buying';

UPDATE public.blog_posts SET body_html = replace(body_html,
  '<h2>Walkability, Transit, and Commute</h2>',
  '<h2>Walkability, Transit, and Commute</h2>
<figure><img src="/__l5e/assets-v1/8da73e28-b808-4d53-b65f-6beef48adb12/blog-nb-walkability.jpg" alt="A walkable neighborhood main street with a coffee shop, bike parked at the curb, and a pedestrian crossing" loading="lazy" /><figcaption>Walkable streets with everyday amenities within a 15-minute radius command a consistent price premium.</figcaption></figure>'
) WHERE slug = 'how-to-evaluate-neighborhood-before-buying';

UPDATE public.blog_posts SET body_html = replace(body_html,
  '<h2>Future Development — What the Neighborhood Is Becoming</h2>',
  '<h2>Future Development — What the Neighborhood Is Becoming</h2>
<figure><img src="/__l5e/assets-v1/ac289775-2363-455a-bd01-b81bc572097f/blog-nb-development.jpg" alt="A construction crane above a new mid-rise apartment building next to older single-family homes" loading="lazy" /><figcaption>Check zoning maps and planning agendas — what''s under construction next door will shape value for years.</figcaption></figure>'
) WHERE slug = 'how-to-evaluate-neighborhood-before-buying';

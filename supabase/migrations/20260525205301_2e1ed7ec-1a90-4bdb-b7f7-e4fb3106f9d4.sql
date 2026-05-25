
-- 1. investor_briefs
create table public.investor_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generated_at timestamptz not null default now(),
  intro_text text not null default '',
  insights jsonb not null default '[]'::jsonb,
  followups text[] not null default '{}',
  context_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'ready' check (status in ('pending','ready','failed','edited')),
  edited_at timestamptz,
  edited_intro text,
  edited_insights jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index investor_briefs_user_idx on public.investor_briefs(user_id, generated_at desc);

alter table public.investor_briefs enable row level security;

create policy "Users can view their own briefs" on public.investor_briefs
  for select using (auth.uid() = user_id);
create policy "Users can insert their own briefs" on public.investor_briefs
  for insert with check (auth.uid() = user_id);
create policy "Users can update their own briefs" on public.investor_briefs
  for update using (auth.uid() = user_id);
create policy "Users can delete their own briefs" on public.investor_briefs
  for delete using (auth.uid() = user_id);

-- 2. investor_brief_cards
create table public.investor_brief_cards (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.investor_briefs(id) on delete cascade,
  card_type text not null,
  position int not null default 0,
  config jsonb not null default '{}'::jsonb,
  data_snapshot jsonb not null default '{}'::jsonb,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index investor_brief_cards_brief_idx on public.investor_brief_cards(brief_id, position);

alter table public.investor_brief_cards enable row level security;

create policy "Users can view their own brief cards" on public.investor_brief_cards
  for select using (
    exists (select 1 from public.investor_briefs b where b.id = brief_id and b.user_id = auth.uid())
  );
create policy "Users can insert their own brief cards" on public.investor_brief_cards
  for insert with check (
    exists (select 1 from public.investor_briefs b where b.id = brief_id and b.user_id = auth.uid())
  );
create policy "Users can update their own brief cards" on public.investor_brief_cards
  for update using (
    exists (select 1 from public.investor_briefs b where b.id = brief_id and b.user_id = auth.uid())
  );
create policy "Users can delete their own brief cards" on public.investor_brief_cards
  for delete using (
    exists (select 1 from public.investor_briefs b where b.id = brief_id and b.user_id = auth.uid())
  );

-- 3. investor_talking_points
create table public.investor_talking_points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  source_card_id uuid references public.investor_brief_cards(id) on delete set null,
  source_card_type text,
  pinned_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active','archived'))
);
create index investor_talking_points_user_idx on public.investor_talking_points(user_id, pinned_at desc);

alter table public.investor_talking_points enable row level security;

create policy "Users can view their own talking points" on public.investor_talking_points
  for select using (auth.uid() = user_id);
create policy "Users can insert their own talking points" on public.investor_talking_points
  for insert with check (auth.uid() = user_id);
create policy "Users can update their own talking points" on public.investor_talking_points
  for update using (auth.uid() = user_id);
create policy "Users can delete their own talking points" on public.investor_talking_points
  for delete using (auth.uid() = user_id);

-- 4. investor_card_feedback
create table public.investor_card_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_type text not null,
  brief_card_id uuid references public.investor_brief_cards(id) on delete set null,
  signal text not null check (signal in ('up','down','investigated','copied','pinned','dismissed')),
  created_at timestamptz not null default now()
);
create index investor_card_feedback_user_type_idx on public.investor_card_feedback(user_id, card_type, created_at desc);

alter table public.investor_card_feedback enable row level security;

create policy "Users can view their own feedback" on public.investor_card_feedback
  for select using (auth.uid() = user_id);
create policy "Users can insert their own feedback" on public.investor_card_feedback
  for insert with check (auth.uid() = user_id);
create policy "Users can delete their own feedback" on public.investor_card_feedback
  for delete using (auth.uid() = user_id);

-- 5. investor_brief_events (telemetry)
create table public.investor_brief_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  brief_id uuid references public.investor_briefs(id) on delete set null,
  card_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index investor_brief_events_user_idx on public.investor_brief_events(user_id, created_at desc);

alter table public.investor_brief_events enable row level security;

create policy "Users can view their own brief events" on public.investor_brief_events
  for select using (auth.uid() = user_id);
create policy "Users can insert their own brief events" on public.investor_brief_events
  for insert with check (auth.uid() = user_id);

-- 6. profiles: brief_cadence + brief_card_count
alter table public.profiles
  add column if not exists brief_cadence text not null default 'daily'
    check (brief_cadence in ('daily','weekdays','weekly_monday','manual')),
  add column if not exists brief_card_count int not null default 5
    check (brief_card_count in (3,5,7));

-- updated_at trigger on investor_briefs
create trigger investor_briefs_set_updated_at
  before update on public.investor_briefs
  for each row execute function public.update_updated_at_column();

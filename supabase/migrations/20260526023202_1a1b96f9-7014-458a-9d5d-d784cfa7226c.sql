create table public.investor_console_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null default 'New conversation',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index investor_console_threads_user_idx
  on public.investor_console_threads(user_id, updated_at desc);

alter table public.investor_console_threads enable row level security;

create policy "Users can view their own investor threads"
  on public.investor_console_threads for select
  using (auth.uid() = user_id);
create policy "Users can insert their own investor threads"
  on public.investor_console_threads for insert
  with check (auth.uid() = user_id);
create policy "Users can update their own investor threads"
  on public.investor_console_threads for update
  using (auth.uid() = user_id);
create policy "Users can delete their own investor threads"
  on public.investor_console_threads for delete
  using (auth.uid() = user_id);

create trigger update_investor_console_threads_updated_at
  before update on public.investor_console_threads
  for each row execute function public.update_updated_at_column();


create table public.investor_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.investor_console_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  tool_calls jsonb not null default '[]'::jsonb,
  tool_results jsonb not null default '[]'::jsonb,
  active_card_context jsonb,
  created_at timestamptz not null default now()
);

create index investor_chat_messages_thread_idx
  on public.investor_chat_messages(thread_id, created_at);

alter table public.investor_chat_messages enable row level security;

create policy "Users can view messages in their own threads"
  on public.investor_chat_messages for select
  using (exists (select 1 from public.investor_console_threads t
                 where t.id = thread_id and t.user_id = auth.uid()));
create policy "Users can insert messages in their own threads"
  on public.investor_chat_messages for insert
  with check (exists (select 1 from public.investor_console_threads t
                      where t.id = thread_id and t.user_id = auth.uid()));
create policy "Users can update messages in their own threads"
  on public.investor_chat_messages for update
  using (exists (select 1 from public.investor_console_threads t
                 where t.id = thread_id and t.user_id = auth.uid()));
create policy "Users can delete messages in their own threads"
  on public.investor_chat_messages for delete
  using (exists (select 1 from public.investor_console_threads t
                 where t.id = thread_id and t.user_id = auth.uid()));


create table public.market_stats (
  market text primary key,
  median_list_price numeric,
  median_rent_monthly numeric,
  appreciation_yoy numeric,
  rent_growth_yoy numeric,
  vacancy_rate numeric,
  days_on_market_median int,
  active_listings int,
  total_sfh_listings int,
  source text,
  refreshed_at timestamptz not null default now()
);

alter table public.market_stats enable row level security;

create policy "Market stats are viewable by everyone"
  on public.market_stats for select using (true);
create policy "Block public insert on market stats"
  on public.market_stats for insert to anon, authenticated with check (false);
create policy "Block public update on market stats"
  on public.market_stats for update to anon, authenticated using (false);
create policy "Service role can write market stats"
  on public.market_stats for all to service_role using (true) with check (true);
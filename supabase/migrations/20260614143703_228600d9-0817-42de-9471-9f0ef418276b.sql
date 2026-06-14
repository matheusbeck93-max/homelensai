
-- user_memories table
CREATE TABLE public.user_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('preference','goal','constraint','context','fact','behavior')),
  content text NOT NULL,
  importance smallint NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  source text NOT NULL DEFAULT 'extracted' CHECK (source IN ('extracted','user_stated','tool_inferred','manual')),
  source_conversation_id uuid,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  reinforced_count integer NOT NULL DEFAULT 0,
  contradicted_count integer NOT NULL DEFAULT 0,
  user_deleted boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_memories TO authenticated;
GRANT ALL ON public.user_memories TO service_role;

ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own memories"
  ON public.user_memories FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own memories"
  ON public.user_memories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own memories"
  ON public.user_memories FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own memories"
  ON public.user_memories FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX user_memories_active_priority_idx
  ON public.user_memories (user_id, importance DESC, last_used_at DESC)
  WHERE NOT user_deleted;

CREATE INDEX user_memories_user_idx ON public.user_memories (user_id);

CREATE TRIGGER user_memories_updated_at
  BEFORE UPDATE ON public.user_memories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- conversations.last_summarized_at
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS last_summarized_at timestamptz;

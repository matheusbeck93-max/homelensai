-- Add missing UPDATE policy for saved_searches table
CREATE POLICY "Users can update their own saved searches"
ON public.saved_searches
FOR UPDATE
USING (auth.uid() = user_id);

-- Add missing UPDATE and DELETE policies for analyses table
CREATE POLICY "Users can update their own analyses"
ON public.analyses
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own analyses"
ON public.analyses
FOR DELETE
USING (auth.uid() = user_id);

-- Add missing UPDATE policy for favorites table (for completeness)
CREATE POLICY "Users can update their own favorites"
ON public.favorites
FOR UPDATE
USING (auth.uid() = user_id);

-- Add missing UPDATE and DELETE policies for messages table
-- Messages belong to conversations, so we check if the user owns the conversation
CREATE POLICY "Users can update messages in their conversations"
ON public.messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND conversations.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete messages in their conversations"
ON public.messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND conversations.user_id = auth.uid()
  )
);
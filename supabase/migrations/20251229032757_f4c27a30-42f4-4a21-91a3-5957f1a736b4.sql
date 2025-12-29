-- Performance Optimization: Add indexes for frequently queried columns

-- Index for favorites by user_id (frequently queried)
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);

-- Index for saved_searches by user_id  
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON public.saved_searches(user_id);

-- Index for portfolio_properties by user_id
CREATE INDEX IF NOT EXISTS idx_portfolio_properties_user_id ON public.portfolio_properties(user_id);

-- Index for conversations by user_id
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);

-- Index for messages by conversation_id
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);

-- Index for properties by city for location searches
CREATE INDEX IF NOT EXISTS idx_properties_city ON public.properties(city);

-- Index for properties by price for range queries
CREATE INDEX IF NOT EXISTS idx_properties_price ON public.properties(price);

-- Index for properties by status for filtering active listings
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);

-- Index for alert_events by user_id and read status
CREATE INDEX IF NOT EXISTS idx_alert_events_user_read ON public.alert_events(user_id, read);

-- Index for search_cache by normalized_query for faster lookups
CREATE INDEX IF NOT EXISTS idx_search_cache_query ON public.search_cache(normalized_query);
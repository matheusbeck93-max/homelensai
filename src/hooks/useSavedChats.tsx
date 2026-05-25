import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Tolerant MATCH_SCORE parser — mirrors the one in Chats.tsx so the
// Save Analysis button keeps working after a conversation is reloaded
// from the database (the messages table has no metadata column, so we
// re-extract the score from the persisted prefix).
function parseMatchScoreFromContent(
  content: string,
): { score: number | null; cleanContent: string } {
  const strict = content.match(/^MATCH_SCORE:\s*([\d.]+)\/10\s*\n?/i);
  if (strict) {
    const score = parseFloat(strict[1]);
    return {
      score: Number.isFinite(score) ? score : null,
      cleanContent: content.slice(strict[0].length).trim(),
    };
  }
  const head = content.slice(0, 300);
  const labeled = head.match(/MATCH[\s_-]?SCORE\s*[:=]?\s*([\d.]+)\s*\/\s*10/i);
  if (labeled) {
    const score = parseFloat(labeled[1]);
    if (Number.isFinite(score)) {
      return { score, cleanContent: content.replace(labeled[0], '').trim() };
    }
  }
  return { score: null, cleanContent: content };
}

export interface ChatMessageAttachment {
  name: string;
  mimeType: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  links?: PropertyLink[];
  attachments?: ChatMessageAttachment[];
  createdAt: string;
  metadata?: Record<string, any>;
  /**
   * 2.5C — Perplexity grounding sources. Rendered as a collapsed
   * <details> footer below the answer; excluded from TTS sanitizer
   * since it lives outside `content`.
   */
  citations?: string[];
}

interface PropertyLink {
  title: string;
  url: string;
  source: string;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export function useSavedChats() {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Check auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load conversations when user logs in
  useEffect(() => {
    if (user) {
      loadConversations();
    } else {
      setConversations([]);
      setCurrentConversationId(null);
    }
  }, [user]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      setConversations(data?.map(c => ({
        id: c.id,
        title: c.title,
        createdAt: c.created_at,
        updatedAt: c.updated_at
      })) || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  }, [user]);

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      setMessages(data?.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        createdAt: m.created_at,
        metadata: {}
      })) || []);
      
      setCurrentConversationId(conversationId);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: "Error",
        description: "Could not load chat history",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const createConversation = useCallback(async (firstMessage: string): Promise<string | null> => {
    if (!user) return null;
    
    try {
      // Generate a title from the first message
      const title = firstMessage.length > 50 
        ? firstMessage.substring(0, 47) + '...'
        : firstMessage;
      
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title
        })
        .select()
        .single();

      if (error) throw error;
      
      const newConversation = {
        id: data.id,
        title: data.title,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
      
      setConversations(prev => [newConversation, ...prev]);
      setCurrentConversationId(data.id);
      
      return data.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
  }, [user]);

  const saveMessage = useCallback(async (
    message: ChatMessage, 
    conversationId?: string
  ): Promise<boolean> => {
    if (!user) return false;
    
    const targetConversationId = conversationId || currentConversationId;
    if (!targetConversationId) return false;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: targetConversationId,
          role: message.role,
          content: message.content
        });

      if (error) throw error;
      
      // Update conversation's updated_at
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', targetConversationId);
      
      return true;
    } catch (error) {
      console.error('Error saving message:', error);
      return false;
    } finally {
      setSaving(false);
    }
  }, [user, currentConversationId]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!user) return;
    
    try {
      // Messages will be deleted via cascade
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;
      
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      
      if (currentConversationId === conversationId) {
        setCurrentConversationId(null);
        setMessages([]);
      }
      
      toast({
        title: "Chat deleted",
        description: "The conversation has been removed"
      });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: "Error",
        description: "Could not delete conversation",
        variant: "destructive"
      });
    }
  }, [user, currentConversationId, toast]);

  const renameConversation = useCallback(async (conversationId: string, newTitle: string) => {
    if (!user || !newTitle.trim()) return false;
    
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ title: newTitle.trim(), updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      if (error) throw error;
      
      setConversations(prev => prev.map(c => 
        c.id === conversationId 
          ? { ...c, title: newTitle.trim(), updatedAt: new Date().toISOString() }
          : c
      ));
      
      toast({
        title: "Chat renamed",
        description: "The conversation title has been updated"
      });
      
      return true;
    } catch (error) {
      console.error('Error renaming conversation:', error);
      toast({
        title: "Error",
        description: "Could not rename conversation",
        variant: "destructive"
      });
      return false;
    }
  }, [user, toast]);

  const startNewChat = useCallback(() => {
    setCurrentConversationId(null);
    setMessages([]);
  }, []);

  const clearAllConversations = useCallback(async () => {
    if (!user) return;
    
    try {
      // Delete all conversations for this user (messages cascade)
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      
      setConversations([]);
      setCurrentConversationId(null);
      setMessages([]);
      
      toast({
        title: "History cleared",
        description: "All your conversations have been deleted"
      });
    } catch (error) {
      console.error('Error clearing conversations:', error);
      toast({
        title: "Error",
        description: "Could not clear conversation history",
        variant: "destructive"
      });
    }
  }, [user, toast]);

  return {
    user,
    conversations,
    currentConversationId,
    messages,
    setMessages,
    loading,
    saving,
    loadConversations,
    loadMessages,
    createConversation,
    saveMessage,
    deleteConversation,
    renameConversation,
    startNewChat,
    clearAllConversations
  };
}

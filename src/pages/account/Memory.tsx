import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { MemoryRow, type MemoryRowData } from '@/components/account/MemoryRow';
import { toast } from '@/hooks/use-toast';

const CATEGORY_ORDER = ['goal', 'constraint', 'preference', 'context', 'fact', 'behavior'];

export default function Memory() {
  const [memories, setMemories] = useState<MemoryRowData[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_memories')
      .select('id, category, content, importance, source, last_used_at')
      .eq('user_deleted', false)
      .order('importance', { ascending: false })
      .order('last_used_at', { ascending: false });
    if (error) {
      console.error(error);
      toast({ title: 'Could not load memories', variant: 'destructive' });
    } else {
      setMemories((data ?? []) as MemoryRowData[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave(id: string, content: string) {
    const { error } = await supabase
      .from('user_memories')
      .update({ content, source: 'manual' })
      .eq('id', id);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    setMemories((curr) => curr.map((m) => (m.id === id ? { ...m, content } : m)));
  }

  async function handleDelete(id: string) {
    const { error } = await supabase
      .from('user_memories')
      .update({ user_deleted: true })
      .eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    setMemories((curr) => curr.filter((m) => m.id !== id));
  }

  async function forgetEverything() {
    if (!confirm('Permanently forget everything HomeLens remembers about you? This cannot be undone.')) return;
    const { data: who } = await supabase.auth.getUser();
    if (!who.user) return;
    const { error } = await supabase
      .from('user_memories')
      .delete()
      .eq('user_id', who.user.id);
    if (error) {
      toast({ title: 'Could not clear memories', description: error.message, variant: 'destructive' });
      return;
    }
    setMemories([]);
    toast({ title: 'All memories cleared' });
  }

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: memories.filter((m) => m.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 pt-24 pb-16 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">What HomeLens remembers</h1>
        <p className="text-muted-foreground mb-8">
          Durable facts and preferences carried across your chats so the assistant doesn't
          ask the same questions twice. Edit or remove anything that's off.
        </p>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : memories.length === 0 ? (
          <div className="text-center py-12 border rounded-md">
            <p className="text-muted-foreground">
              Nothing remembered yet. After a few chats, durable preferences will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map((g) => (
              <section key={g.cat}>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  {g.cat}
                </h2>
                <div className="space-y-2">
                  {g.items.map((m) => (
                    <MemoryRow
                      key={m.id}
                      memory={m}
                      onSave={handleSave}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {memories.length > 0 && (
          <div className="mt-12 pt-6 border-t">
            <Button variant="destructive" onClick={forgetEverything}>
              Forget everything HomeLens remembers about me
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
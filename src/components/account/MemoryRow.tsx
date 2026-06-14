import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Check, X } from 'lucide-react';

export interface MemoryRowData {
  id: string;
  category: string;
  content: string;
  importance: number;
  source: string;
  last_used_at: string;
}

interface Props {
  memory: MemoryRowData;
  onSave: (id: string, content: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}

export function MemoryRow({ memory, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memory.content);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!draft.trim() || draft.trim() === memory.content) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onSave(memory.id, draft.trim().slice(0, 400));
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await onDelete(memory.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-3 border rounded-md p-3 bg-card">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {memory.category}
          </span>
          <span className="text-xs text-muted-foreground">· importance {memory.importance}/5</span>
        </div>
        {editing ? (
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={400}
            autoFocus
          />
        ) : (
          <p className="text-sm break-words">{memory.content}</p>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        {editing ? (
          <>
            <Button size="icon" variant="ghost" onClick={save} disabled={busy} aria-label="Save">
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setDraft(memory.content);
                setEditing(false);
              }}
              disabled={busy}
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setEditing(true)}
              disabled={busy}
              aria-label="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={remove}
              disabled={busy}
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
import { Sparkles } from 'lucide-react';

interface Props {
  prompts: string[];
  onPick: (prompt: string) => void;
  disabled?: boolean;
}

/**
 * Three suggestion chips shown in the Deep Dive right panel so the user
 * can iterate without having to phrase the first follow-up themselves.
 */
export function StarterPrompts({ prompts, onPick, disabled }: Props) {
  if (!prompts.length) return null;
  return (
    <div className="border rounded-lg p-3 bg-muted/20">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
        <Sparkles className="h-3.5 w-3.5" /> Try a follow-up
      </div>
      <div className="flex flex-wrap gap-2">
        {prompts.map((p) => (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => onPick(p)}
            className="text-xs text-left px-2.5 py-1.5 rounded-md border bg-background hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
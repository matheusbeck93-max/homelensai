import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Home, Building2, Hammer, Briefcase, Shuffle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PERSONA_ORDER, PERSONAS, type PersonaId } from '@/lib/personas/personaRegistry';

interface Props {
  value?: PersonaId | null;
  secondary?: PersonaId[];
  onChange: (primary: PersonaId, secondary: PersonaId[]) => void | Promise<void>;
  saving?: boolean;
  /** When true, show the secondary multi-select. Defaults to true. */
  showSecondary?: boolean;
}

const ICONS: Record<PersonaId, React.ElementType> = {
  first_time_buyer: Home,
  rental_investor: Building2,
  flipper: Hammer,
  institutional: Briefcase,
  mixed: Shuffle,
};

export function PersonaPicker({
  value,
  secondary = [],
  onChange,
  saving,
  showSecondary = true,
}: Props) {
  const [selected, setSelected] = useState<PersonaId | null>(value ?? null);
  const [sec, setSec] = useState<PersonaId[]>(secondary);

  const toggleSecondary = (id: PersonaId) => {
    if (id === selected || id === 'mixed') return;
    setSec((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const canSave = !!selected;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold">What kind of investor are you?</h2>
        <p className="text-sm text-muted-foreground">
          We'll tune your Brief, calculator defaults, and AI tool selection to your focus.
          You can change this any time in Preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PERSONA_ORDER.map((id) => {
          const def = PERSONAS[id];
          const Icon = ICONS[id];
          const isSelected = selected === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setSelected(id);
                if (sec.includes(id)) setSec((prev) => prev.filter((p) => p !== id));
              }}
              className={cn(
                'text-left rounded-lg border p-4 transition-all touch-manipulation',
                'active:scale-[0.98] hover:border-primary/40 hover:bg-muted/30',
                isSelected && 'border-primary bg-primary/5 ring-1 ring-primary',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <Icon className="h-5 w-5 text-primary" />
                {isSelected && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="mt-3 font-semibold text-sm">{def.displayName}</div>
              <div className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {def.description}
              </div>
            </button>
          );
        })}
      </div>

      {showSecondary && selected && selected !== 'mixed' && (
        <Card className="p-4 space-y-3">
          <div>
            <div className="text-sm font-medium">Any other interests?</div>
            <div className="text-xs text-muted-foreground">
              Pick up to 2. We'll blend these in at 30% weight.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {PERSONA_ORDER.filter((id) => id !== 'mixed' && id !== selected).map((id) => {
              const def = PERSONAS[id];
              const active = sec.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleSecondary(id)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs border transition-colors touch-manipulation min-h-[36px]',
                    active
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-muted/40',
                  )}
                >
                  {def.displayName}
                </button>
              );
            })}
          </div>
          {sec.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {sec.map((id) => (
                <Badge key={id} variant="secondary" className="text-[10px]">
                  + {PERSONAS[id].displayName}
                </Badge>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          disabled={!canSave || saving}
          onClick={() => selected && onChange(selected, sec)}
        >
          {saving ? 'Saving...' : 'Save investor focus'}
        </Button>
      </div>
    </div>
  );
}
import { useState, type KeyboardEvent, type ClipboardEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  dedupeLocations,
  isValidLocation,
  normalizeLocation,
} from '@/lib/preferences/locations';
import { cn } from '@/lib/utils';

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  id?: string;
}

/**
 * Chip-style input for "City, ST" locations.
 * - Enter / Tab commits the current value as a chip.
 * - Commas and spaces are allowed inside the input (city names can have both).
 * - Pasting newline-separated lists creates multiple chips at once.
 */
export function LocationChipInput({ value, onChange, placeholder, id }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addOne = (raw: string): boolean => {
    const normalized = normalizeLocation(raw.replace(/,$/, ''));
    if (!normalized) return false;
    if (!isValidLocation(normalized)) {
      setError('Use the format "City, ST" — e.g. "Las Vegas, NV"');
      return false;
    }
    onChange(dedupeLocations([...value, normalized]));
    setError(null);
    return true;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      const v = text.trim();
      if (!v) return;
      e.preventDefault();
      if (addOne(v)) setText('');
    } else if (e.key === 'Backspace' && !text && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted.includes('\n')) return; // single line — let default behavior handle
    e.preventDefault();
    const parts = pasted
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const next = [...value];
    let invalid = 0;
    for (const p of parts) {
      const normalized = normalizeLocation(p.replace(/,$/, ''));
      if (normalized && isValidLocation(normalized)) next.push(normalized);
      else invalid++;
    }
    onChange(dedupeLocations(next));
    setError(invalid > 0 ? `${invalid} line(s) skipped — use "City, ST" format` : null);
  };

  const removeAt = (i: number) =>
    onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          'flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 min-h-10 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0',
        )}
      >
        {value.map((loc, i) => (
          <span
            key={`${loc}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
          >
            {loc}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-4 w-4 hover:bg-transparent"
              onClick={() => removeAt(i)}
              aria-label={`Remove ${loc}`}
            >
              <X className="h-3 w-3" />
            </Button>
          </span>
        ))}
        <Input
          id={id}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => {
            if (text.trim() && addOne(text)) setText('');
          }}
          placeholder={value.length === 0 ? (placeholder ?? 'e.g. Las Vegas, NV') : ''}
          className="border-0 shadow-none focus-visible:ring-0 h-7 flex-1 min-w-[140px] px-1 text-sm"
        />
      </div>
      <p className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>
        {error ?? 'Press Enter after each location. Spaces and commas are allowed.'}
      </p>
    </div>
  );
}
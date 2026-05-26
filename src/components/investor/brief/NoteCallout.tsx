import { Pin } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface Props {
  initials?: string;
  text: string;
  meta?: string;
}

export function NoteCallout({ initials = 'You', text, meta }: Props) {
  return (
    <Card className="p-3 flex items-start gap-3 bg-muted/30 border-dashed">
      <div className="h-7 w-7 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[11px] font-semibold">
        {initials.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Pin className="h-3 w-3" /> Investor note
          {meta && <span className="ml-1">· {meta}</span>}
        </div>
        <p className="text-sm leading-snug mt-0.5">{text}</p>
      </div>
    </Card>
  );
}
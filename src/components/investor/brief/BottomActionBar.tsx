import { Button } from '@/components/ui/button';
import { Pencil, Pin } from 'lucide-react';

interface Props {
  onEdit: () => void;
  onAddTalkingPoint: () => void;
  disabled?: boolean;
}

export function BottomActionBar({ onEdit, onAddTalkingPoint, disabled }: Props) {
  return (
    <div className="sticky bottom-0 mt-4 flex items-center justify-end gap-2 border-t bg-background/95 backdrop-blur px-2 py-3">
      <Button variant="ghost" size="sm" onClick={onEdit} disabled={disabled} className="gap-1.5">
        <Pencil className="h-3.5 w-3.5" /> Edit brief
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onAddTalkingPoint}
        disabled={disabled}
        className="gap-1.5"
      >
        <Pin className="h-3.5 w-3.5" /> Add talking point
      </Button>
    </div>
  );
}
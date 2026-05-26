import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { InsightBullet } from '@/lib/investorBrief/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intro: string;
  insights: InsightBullet[];
  onSave: (next: { intro: string; insights: InsightBullet[] }) => Promise<void> | void;
}

export function BriefEditDialog({ open, onOpenChange, intro, insights, onSave }: Props) {
  const [draftIntro, setDraftIntro] = useState(intro);
  const [draftBullets, setDraftBullets] = useState(insights.map((b) => b.text).join('\n'));
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    setBusy(true);
    try {
      const lines = draftBullets
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const nextInsights: InsightBullet[] = lines.map((text, i) => ({
        text,
        citedCardIds: insights[i]?.citedCardIds ?? [],
        severity: insights[i]?.severity ?? 'info',
      }));
      await onSave({ intro: draftIntro, insights: nextInsights });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit brief</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Intro</Label>
            <Textarea
              value={draftIntro}
              onChange={(e) => setDraftIntro(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Insights (one per line)</Label>
            <Textarea
              value={draftBullets}
              onChange={(e) => setDraftBullets(e.target.value)}
              rows={6}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
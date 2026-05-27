import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import type { OwnedProperty } from '@/lib/myProperties/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: OwnedProperty;
  onSaved?: () => void;
}

export function EditValuationDialog({ open, onOpenChange, property, onSaved }: Props) {
  const [value, setValue] = useState<string>(
    property.current_value_manual_override?.toString() ??
      property.current_value_estimate?.toString() ??
      '',
  );
  const [note, setNote] = useState(property.current_value_manual_note ?? '');
  const [expires, setExpires] = useState<string>(
    property.current_value_manual_expires_at?.slice(0, 10) ?? '',
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const num = Number(value);
    if (!num || num <= 0) {
      toast.error('Enter a valid value');
      return;
    }
    setSaving(true);
    const patch: Record<string, any> = {
      current_value_estimate: num,
      current_value_source: 'manual_override',
      current_value_manual_override: num,
      current_value_manual_note: note || null,
      current_value_manual_expires_at: expires ? new Date(expires).toISOString() : null,
      current_value_refreshed_at: new Date().toISOString(),
    };
    const { error } = await (supabase as any)
      .from('investor_owned_properties')
      .update(patch)
      .eq('id', property.id);
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    // Audit row
    await (supabase as any).from('investor_owned_property_valuations').insert({
      property_id: property.id,
      value: num,
      source: 'manual_override',
      note: note || null,
    });
    toast.success('Valuation updated');
    setSaving(false);
    onOpenChange(false);
    onSaved?.();
  }

  async function handleClear() {
    setSaving(true);
    const { error } = await (supabase as any)
      .from('investor_owned_properties')
      .update({
        current_value_manual_override: null,
        current_value_manual_note: null,
        current_value_manual_expires_at: null,
      })
      .eq('id', property.id);
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    toast.success('Manual override cleared');
    setSaving(false);
    onOpenChange(false);
    onSaved?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit valuation</DialogTitle>
          <DialogDescription>
            Override the auto-estimate with your own number (e.g. a recent appraisal). The
            override applies until the expiry date — after that we fall back to auto-valuation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="val">Current value</Label>
            <Input
              id="val"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="450000"
            />
          </div>
          <div>
            <Label htmlFor="exp">Expires (optional)</Label>
            <Input
              id="exp"
              type="date"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Appraisal from May 2026, comps adjusted for new roof…"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {property.current_value_manual_override != null && (
            <Button variant="ghost" onClick={handleClear} disabled={saving}>
              Clear override
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
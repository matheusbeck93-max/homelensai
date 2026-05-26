import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Preferences } from "./preferencesTypes";
import { LocationChipInput } from "./LocationChipInput";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: Preferences;
  onSave: (next: Preferences) => Promise<void> | void;
}

const csv = (arr?: string[]) => (arr ?? []).join(", ");
const fromCsv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const numOrNull = (s: string): number | null => {
  const cleaned = s.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

export function PreferencesEditDialog({ open, onOpenChange, value, onSave }: Props) {
  const [draft, setDraft] = useState<Preferences>(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(value); }, [value, open]);

  const update = (fn: (p: Preferences) => Preferences) => setDraft((d) => fn({ ...d }));

  const submit = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      onOpenChange(false);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit preferences</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Goal</Label>
            <Select
              value={draft.goal ?? ""}
              onValueChange={(v) => update((d) => ({ ...d, goal: v || null }))}
            >
              <SelectTrigger><SelectValue placeholder="Select goal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="buy_home">Buy a home</SelectItem>
                <SelectItem value="invest">Invest</SelectItem>
                <SelectItem value="both">Both</SelectItem>
                <SelectItem value="rent">Rent</SelectItem>
                <SelectItem value="market_research">Market research</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Locations</Label>
            <LocationChipInput
              value={draft.locations ?? []}
              onChange={(next) => update((d) => ({ ...d, locations: next }))}
              placeholder="e.g. Las Vegas, NV"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Max price</Label>
              <Input
                value={draft.budget?.purchase_price_max ?? ""}
                onChange={(e) => update((d) => ({ ...d, budget: { ...d.budget, purchase_price_max: numOrNull(e.target.value) } }))}
                placeholder="650000"
              />
            </div>
            <div>
              <Label>Max monthly</Label>
              <Input
                value={draft.budget?.monthly_payment_max ?? ""}
                onChange={(e) => update((d) => ({ ...d, budget: { ...d.budget, monthly_payment_max: numOrNull(e.target.value) } }))}
                placeholder="3200"
              />
            </div>
            <div>
              <Label>Down payment</Label>
              <Input
                value={draft.budget?.down_payment ?? ""}
                onChange={(e) => update((d) => ({ ...d, budget: { ...d.budget, down_payment: numOrNull(e.target.value) } }))}
                placeholder="80000"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Min beds</Label>
              <Input
                value={draft.property?.bedrooms_min ?? ""}
                onChange={(e) => update((d) => ({ ...d, property: { ...d.property, bedrooms_min: numOrNull(e.target.value) } }))}
              />
            </div>
            <div>
              <Label>Min baths</Label>
              <Input
                value={draft.property?.bathrooms_min ?? ""}
                onChange={(e) => update((d) => ({ ...d, property: { ...d.property, bathrooms_min: numOrNull(e.target.value) } }))}
              />
            </div>
            <div>
              <Label>Min sqft</Label>
              <Input
                value={draft.property?.sqft_min ?? ""}
                onChange={(e) => update((d) => ({ ...d, property: { ...d.property, sqft_min: numOrNull(e.target.value) } }))}
              />
            </div>
          </div>

          <div>
            <Label>Property types (comma-separated)</Label>
            <Input
              value={csv(draft.property?.types)}
              onChange={(e) => update((d) => ({ ...d, property: { ...d.property, types: fromCsv(e.target.value) } }))}
              placeholder="house, townhouse, condo"
            />
          </div>

          <div>
            <Label>Must-haves</Label>
            <Input value={csv(draft.must_haves)} onChange={(e) => update((d) => ({ ...d, must_haves: fromCsv(e.target.value) }))} placeholder="garage, 2-car parking, updated kitchen" />
          </div>
          <div>
            <Label>Nice-to-haves</Label>
            <Input value={csv(draft.nice_to_haves)} onChange={(e) => update((d) => ({ ...d, nice_to_haves: fromCsv(e.target.value) }))} placeholder="pool, large yard" />
          </div>
          <div>
            <Label>Deal breakers</Label>
            <Input value={csv(draft.deal_breakers)} onChange={(e) => update((d) => ({ ...d, deal_breakers: fromCsv(e.target.value) }))} placeholder="HOA, busy road" />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={draft.freeform_notes ?? ""}
              onChange={(e) => update((d) => ({ ...d, freeform_notes: e.target.value }))}
              rows={3}
              placeholder="Anything else HomeLens should know..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
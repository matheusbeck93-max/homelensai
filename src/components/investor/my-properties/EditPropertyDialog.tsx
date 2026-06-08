import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { PROPERTY_TYPE_LABELS, type OwnedPropertyType } from '@/lib/myProperties/types';
import type { OwnedPropertyWithMetrics } from '@/hooks/useOwnedProperties';

interface Props {
  property: OwnedPropertyWithMetrics | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const toStr = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export function EditPropertyDialog({ property, open, onOpenChange, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [propertyType, setPropertyType] = useState<OwnedPropertyType>('single_family');
  const [beds, setBeds] = useState('');
  const [baths, setBaths] = useState('');
  const [sqft, setSqft] = useState('');

  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [downPayment, setDownPayment] = useState('');

  const [hasMortgage, setHasMortgage] = useState(false);
  const [loanPrincipal, setLoanPrincipal] = useState('');
  const [loanRate, setLoanRate] = useState('');
  const [loanTerm, setLoanTerm] = useState('');
  const [loanStart, setLoanStart] = useState('');
  const [loanBalance, setLoanBalance] = useState('');

  const [isRented, setIsRented] = useState(false);
  const [isPrimary, setIsPrimary] = useState(false);
  const [monthlyRent, setMonthlyRent] = useState('');

  useEffect(() => {
    if (!property) return;
    setAddressLine1(property.address_line1 ?? '');
    setCity(property.city ?? '');
    setState(property.state ?? '');
    setZip(toStr((property as any).zip));
    setPropertyType((property.property_type as OwnedPropertyType) ?? 'single_family');
    setBeds(toStr((property as any).beds));
    setBaths(toStr((property as any).baths));
    setSqft(toStr((property as any).sqft));
    setPurchaseDate(toStr(property.purchase_date)?.slice(0, 10) ?? '');
    setPurchasePrice(toStr(property.purchase_price));
    setDownPayment(toStr((property as any).down_payment));
    setHasMortgage(Boolean(property.has_mortgage));
    setLoanPrincipal(toStr(property.loan_original_principal));
    setLoanRate(
      property.loan_rate_apr != null ? String(Number(property.loan_rate_apr) * 100) : '',
    );
    setLoanTerm(toStr(property.loan_term_years));
    setLoanStart(toStr(property.loan_start_date)?.slice(0, 10) ?? '');
    setLoanBalance(toStr(property.loan_current_balance));
    setIsRented(Boolean(property.is_rented));
    setIsPrimary(Boolean(property.is_primary_residence));
    setMonthlyRent(toStr(property.rental?.monthly_rent));
  }, [property]);

  const canSave =
    !!property &&
    !!addressLine1.trim() &&
    !!city.trim() &&
    !!state.trim() &&
    !!purchaseDate &&
    Number(purchasePrice) > 0;

  const handleSave = async () => {
    if (!canSave || !property) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        address_line1: addressLine1.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase().slice(0, 2),
        zip: zip.trim() || null,
        property_type: propertyType,
        beds: beds ? Number(beds) : null,
        baths: baths ? Number(baths) : null,
        sqft: sqft ? Number(sqft) : null,
        purchase_date: purchaseDate,
        purchase_price: Number(purchasePrice),
        down_payment: downPayment ? Number(downPayment) : null,
        has_mortgage: hasMortgage,
        loan_original_principal: hasMortgage && loanPrincipal ? Number(loanPrincipal) : null,
        loan_rate_apr: hasMortgage && loanRate ? Number(loanRate) / 100 : null,
        loan_term_years: hasMortgage && loanTerm ? Number(loanTerm) : null,
        loan_start_date: hasMortgage && loanStart ? loanStart : null,
        loan_current_balance: hasMortgage && loanBalance ? Number(loanBalance) : null,
        is_rented: isRented,
        is_primary_residence: isPrimary,
      };

      const { error } = await (supabase as any)
        .from('investor_owned_properties')
        .update(updates)
        .eq('id', property.id);
      if (error) throw error;

      if (isRented && monthlyRent) {
        const rent = Number(monthlyRent);
        if (property.rental) {
          await (supabase as any)
            .from('investor_owned_property_rental')
            .update({ monthly_rent: rent })
            .eq('property_id', property.id);
        } else {
          await (supabase as any)
            .from('investor_owned_property_rental')
            .insert({ property_id: property.id, monthly_rent: rent });
        }
      }

      toast({ title: 'Property updated', description: addressLine1 });
      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      toast({
        title: 'Could not update property',
        description: err?.message ?? String(err),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit property</DialogTitle>
          <DialogDescription>
            Update details, loan, or rental info. Changes refresh portfolio metrics.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Identity</h3>
            <div>
              <Label htmlFor="e-addr">Street address</Label>
              <Input id="e-addr" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label htmlFor="e-city">City</Label>
                <Input id="e-city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="e-state">State</Label>
                <Input id="e-state" value={state} onChange={(e) => setState(e.target.value)} maxLength={2} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="e-zip">Zip</Label>
                <Input id="e-zip" value={zip} onChange={(e) => setZip(e.target.value)} />
              </div>
              <div>
                <Label>Property type</Label>
                <Select value={propertyType} onValueChange={(v: OwnedPropertyType) => setPropertyType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PROPERTY_TYPE_LABELS) as OwnedPropertyType[]).map((k) => (
                      <SelectItem key={k} value={k}>{PROPERTY_TYPE_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="e-beds">Beds</Label>
                <Input id="e-beds" type="number" value={beds} onChange={(e) => setBeds(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="e-baths">Baths</Label>
                <Input id="e-baths" type="number" step="0.5" value={baths} onChange={(e) => setBaths(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="e-sqft">Sqft</Label>
                <Input id="e-sqft" type="number" value={sqft} onChange={(e) => setSqft(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium">Acquisition</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="e-pdate">Purchase date</Label>
                <Input id="e-pdate" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="e-pprice">Purchase price</Label>
                <Input id="e-pprice" type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="e-down">Down payment</Label>
                <Input id="e-down" type="number" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Loan</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Cash</span>
                <Switch checked={hasMortgage} onCheckedChange={setHasMortgage} />
                <span>Mortgage</span>
              </div>
            </div>
            {hasMortgage && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="e-lp">Original principal</Label>
                  <Input id="e-lp" type="number" value={loanPrincipal} onChange={(e) => setLoanPrincipal(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="e-lr">Rate (%)</Label>
                  <Input id="e-lr" type="number" step="0.001" value={loanRate} onChange={(e) => setLoanRate(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="e-lt">Term (years)</Label>
                  <Input id="e-lt" type="number" value={loanTerm} onChange={(e) => setLoanTerm(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="e-ls">Loan start</Label>
                  <Input id="e-ls" type="date" value={loanStart} onChange={(e) => setLoanStart(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="e-lb">Current balance (optional)</Label>
                  <Input id="e-lb" type="number" value={loanBalance} onChange={(e) => setLoanBalance(e.target.value)} />
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Occupancy</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Owner-occupied</span>
                <Switch checked={isPrimary} onCheckedChange={(v) => { setIsPrimary(v); if (v) setIsRented(false); }} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Rental</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Not rented</span>
                <Switch checked={isRented} onCheckedChange={(v) => { setIsRented(v); if (v) setIsPrimary(false); }} />
                <span>Currently rented</span>
              </div>
            </div>
            {isRented && (
              <div>
                <Label htmlFor="e-rent">Monthly rent</Label>
                <Input id="e-rent" type="number" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} />
              </div>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
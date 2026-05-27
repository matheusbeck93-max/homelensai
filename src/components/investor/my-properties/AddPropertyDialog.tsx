import { useState } from 'react';
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export function AddPropertyDialog({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [propertyType, setPropertyType] = useState<OwnedPropertyType>('single_family');
  const [beds, setBeds] = useState<string>('');
  const [baths, setBaths] = useState<string>('');
  const [sqft, setSqft] = useState<string>('');

  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [downPayment, setDownPayment] = useState<string>('');

  const [hasMortgage, setHasMortgage] = useState(true);
  const [loanPrincipal, setLoanPrincipal] = useState<string>('');
  const [loanRate, setLoanRate] = useState<string>('');
  const [loanTerm, setLoanTerm] = useState<string>('30');
  const [loanStart, setLoanStart] = useState<string>(todayISO());

  const [isRented, setIsRented] = useState(false);
  const [monthlyRent, setMonthlyRent] = useState<string>('');

  const reset = () => {
    setAddressLine1(''); setCity(''); setState(''); setZip('');
    setPropertyType('single_family');
    setBeds(''); setBaths(''); setSqft('');
    setPurchaseDate(todayISO()); setPurchasePrice(''); setDownPayment('');
    setHasMortgage(true); setLoanPrincipal(''); setLoanRate('');
    setLoanTerm('30'); setLoanStart(todayISO());
    setIsRented(false); setMonthlyRent('');
  };

  const canSave =
    !!addressLine1.trim() &&
    !!city.trim() &&
    !!state.trim() &&
    !!zip.trim() &&
    !!purchaseDate &&
    Number(purchasePrice) > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Please sign in', variant: 'destructive' });
        return;
      }

      const insertPayload: any = {
        user_id: user.id,
        address_line1: addressLine1.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase().slice(0, 2),
        zip: zip.trim(),
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
        loan_start_date: hasMortgage ? loanStart : null,
        is_rented: isRented,
        current_value_estimate: Number(purchasePrice),
        current_value_source: 'seed',
      };

      const { data: created, error } = await (supabase as any)
        .from('investor_owned_properties')
        .insert(insertPayload)
        .select('id')
        .single();
      if (error) throw error;

      if (isRented && monthlyRent) {
        await (supabase as any).from('investor_owned_property_rental').insert({
          property_id: created.id,
          monthly_rent: Number(monthlyRent),
        });
      }

      await (supabase as any).from('investor_owned_property_events').insert({
        property_id: created.id,
        event_type: 'purchased',
        event_date: purchaseDate,
        details: {
          purchase_price: Number(purchasePrice),
          down_payment: downPayment ? Number(downPayment) : null,
          loan_rate: hasMortgage && loanRate ? Number(loanRate) / 100 : null,
        },
      });

      toast({ title: 'Property added', description: addressLine1 });
      reset();
      onOpenChange(false);
      onCreated?.(created.id);
    } catch (err: any) {
      toast({
        title: 'Could not save property',
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
          <DialogTitle>Add a property</DialogTitle>
          <DialogDescription>
            Identity and acquisition are required. Everything else is optional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Identity</h3>
            <div>
              <Label htmlFor="addr">Street address</Label>
              <Input id="addr" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="1814 Cedar St" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input id="state" value={state} onChange={(e) => setState(e.target.value)} placeholder="TX" maxLength={2} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="zip">Zip</Label>
                <Input id="zip" value={zip} onChange={(e) => setZip(e.target.value)} />
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
                <Label htmlFor="beds">Beds</Label>
                <Input id="beds" type="number" value={beds} onChange={(e) => setBeds(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="baths">Baths</Label>
                <Input id="baths" type="number" step="0.5" value={baths} onChange={(e) => setBaths(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="sqft">Sqft</Label>
                <Input id="sqft" type="number" value={sqft} onChange={(e) => setSqft(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium">Acquisition</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pdate">Purchase date</Label>
                <Input id="pdate" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pprice">Purchase price</Label>
                <Input id="pprice" type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="down">Down payment</Label>
                <Input id="down" type="number" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} />
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
                  <Label htmlFor="lp">Original principal</Label>
                  <Input id="lp" type="number" value={loanPrincipal} onChange={(e) => setLoanPrincipal(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="lr">Rate (%)</Label>
                  <Input id="lr" type="number" step="0.001" value={loanRate} onChange={(e) => setLoanRate(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="lt">Term (years)</Label>
                  <Input id="lt" type="number" value={loanTerm} onChange={(e) => setLoanTerm(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="ls">Loan start</Label>
                  <Input id="ls" type="date" value={loanStart} onChange={(e) => setLoanStart(e.target.value)} />
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Rental</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>No</span>
                <Switch checked={isRented} onCheckedChange={setIsRented} />
                <span>Currently rented</span>
              </div>
            </div>
            {isRented && (
              <div>
                <Label htmlFor="rent">Monthly rent</Label>
                <Input id="rent" type="number" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} />
              </div>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? 'Saving…' : 'Add property'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
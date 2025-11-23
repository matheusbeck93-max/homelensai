import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { PortfolioProperty } from "@/pages/Portfolio";

interface EditPortfolioDialogProps {
  isOpen: boolean;
  onClose: () => void;
  portfolioProperty: PortfolioProperty;
  onUpdate: () => void;
}

export function EditPortfolioDialog({ isOpen, onClose, portfolioProperty, onUpdate }: EditPortfolioDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    purchase_price: portfolioProperty.purchase_price,
    down_payment_pct: portfolioProperty.down_payment_pct,
    interest_rate_pct: portfolioProperty.interest_rate_pct,
    loan_term_years: portfolioProperty.loan_term_years,
    monthly_rent: portfolioProperty.monthly_rent,
    monthly_expenses: portfolioProperty.monthly_expenses,
    notes: portfolioProperty.notes || ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('portfolio_properties')
        .update(formData)
        .eq('id', portfolioProperty.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Portfolio property updated"
      });
      
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating portfolio property:', error);
      toast({
        title: "Error",
        description: "Failed to update portfolio property",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Portfolio Property</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="purchase_price">Purchase Price</Label>
            <Input
              id="purchase_price"
              type="number"
              value={formData.purchase_price}
              onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="down_payment_pct">Down Payment %</Label>
              <Input
                id="down_payment_pct"
                type="number"
                step="0.1"
                value={formData.down_payment_pct}
                onChange={(e) => setFormData({ ...formData, down_payment_pct: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div>
              <Label htmlFor="interest_rate_pct">Interest Rate %</Label>
              <Input
                id="interest_rate_pct"
                type="number"
                step="0.01"
                value={formData.interest_rate_pct}
                onChange={(e) => setFormData({ ...formData, interest_rate_pct: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="loan_term_years">Loan Term (Years)</Label>
            <Input
              id="loan_term_years"
              type="number"
              value={formData.loan_term_years}
              onChange={(e) => setFormData({ ...formData, loan_term_years: parseInt(e.target.value) || 30 })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="monthly_rent">Monthly Rent</Label>
              <Input
                id="monthly_rent"
                type="number"
                value={formData.monthly_rent}
                onChange={(e) => setFormData({ ...formData, monthly_rent: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div>
              <Label htmlFor="monthly_expenses">Monthly Expenses</Label>
              <Input
                id="monthly_expenses"
                type="number"
                value={formData.monthly_expenses}
                onChange={(e) => setFormData({ ...formData, monthly_expenses: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any notes about this property..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

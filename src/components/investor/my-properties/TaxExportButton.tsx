import { useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  buildScheduleERowsForYear,
  downloadScheduleECsv,
} from '@/lib/myProperties/scheduleE';
import { trackOwnedPropertyEvent } from '@/lib/myProperties/telemetry';

export function TaxExportButton({ variant = 'outline' }: { variant?: 'outline' | 'ghost' }) {
  const [busy, setBusy] = useState<number | null>(null);
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear - 2];

  async function exportYear(year: number) {
    setBusy(year);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) {
        toast.error('You must be signed in');
        return;
      }
      const rows = await buildScheduleERowsForYear(uid, year);
      if (rows.length === 0) {
        toast.info(`No rented properties found for ${year}.`);
        return;
      }
      downloadScheduleECsv(rows, year);
      toast.success(`Schedule E for ${year} exported`);
      trackOwnedPropertyEvent('owned_property_tax_export', {
        year,
        property_count: rows.length,
      });
    } catch (e: any) {
      toast.error(e?.message ?? 'Export failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant={variant} className="gap-2">
          {busy !== null ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" />
          )}
          Tax export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Schedule E (CSV)</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {years.map((y) => (
          <DropdownMenuItem
            key={y}
            onClick={() => exportYear(y)}
            disabled={busy === y}
            className="cursor-pointer"
          >
            Tax year {y}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
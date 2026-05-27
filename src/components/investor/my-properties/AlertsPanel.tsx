import { useState } from 'react';
import { Bell, X, RefreshCw, TrendingUp, AlertTriangle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PropertyAlert = {
  id: string;
  alert_type: string;
  severity: 'info' | 'opportunity' | 'warning';
  title: string;
  description: string;
  status: string;
  metadata?: Record<string, unknown> | null;
  surfaced_at: string;
};

interface AlertsPanelProps {
  propertyId: string;
  alerts: PropertyAlert[];
  onChanged: () => void;
}

const SEVERITY_STYLES: Record<PropertyAlert['severity'], { icon: typeof Bell; classes: string; label: string }> = {
  opportunity: { icon: TrendingUp, classes: 'border-emerald-300/50 bg-emerald-50/40 dark:bg-emerald-950/10', label: 'Opportunity' },
  warning: { icon: AlertTriangle, classes: 'border-amber-300/50 bg-amber-50/40 dark:bg-amber-950/10', label: 'Warning' },
  info: { icon: Info, classes: 'border-sky-300/50 bg-sky-50/40 dark:bg-sky-950/10', label: 'Info' },
};

export function AlertsPanel({ propertyId, alerts, onChanged }: AlertsPanelProps) {
  const [reevaluating, setReevaluating] = useState(false);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const active = alerts.filter((a) => a.status === 'active');

  async function handleDismiss(id: string) {
    setDismissing(id);
    const { error } = await supabase
      .from('investor_owned_property_alerts')
      .update({ status: 'dismissed', dismissed_at: new Date().toISOString() })
      .eq('id', id);
    setDismissing(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Alert dismissed');
    onChanged();
  }

  async function handleReevaluate() {
    setReevaluating(true);
    const { data, error } = await supabase.functions.invoke('property-alerts-evaluate', {
      body: {},
    });
    setReevaluating(false);
    if (error) {
      toast.error(error.message ?? 'Could not re-evaluate alerts');
      return;
    }
    toast.success(`Re-evaluated (${(data as any)?.inserted ?? 0} new, ${(data as any)?.resolved ?? 0} resolved)`);
    onChanged();
  }

  if (active.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bell className="h-4 w-4" />
            No active alerts on this property.
          </div>
          <Button size="sm" variant="ghost" onClick={handleReevaluate} disabled={reevaluating}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${reevaluating ? 'animate-spin' : ''}`} />
            Re-evaluate
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bell className="h-4 w-4 text-amber-600" />
          {active.length} active alert{active.length === 1 ? '' : 's'}
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={handleReevaluate} disabled={reevaluating}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${reevaluating ? 'animate-spin' : ''}`} />
          Re-evaluate
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {active.map((a) => {
          const sev = SEVERITY_STYLES[a.severity] ?? SEVERITY_STYLES.info;
          const Icon = sev.icon;
          return (
            <div key={a.id} className={`flex items-start gap-3 rounded-md border p-3 ${sev.classes}`}>
              <Icon className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm font-medium">{a.title}</div>
                  <Badge variant="outline" className="text-[10px] capitalize">{sev.label}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{a.description}</div>
              </div>
              <button
                onClick={() => handleDismiss(a.id)}
                disabled={dismissing === a.id}
                className="text-muted-foreground hover:text-foreground p-1 -m-1 disabled:opacity-50"
                aria-label="Dismiss alert"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
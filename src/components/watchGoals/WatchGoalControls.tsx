/**
 * Shared Watch Goal controls: goal kind, match threshold, notify channel and
 * cadence. Used by the Watch Goals page and the Console panel so both stay in
 * sync. Threshold / notify / kind are persisted inside
 * `saved_searches.filters_json`; cadence is the `alert_frequency` column.
 */
import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  GOAL_KIND_LABEL,
  NOTIFY_LABEL,
  readGoalFields,
  updateGoalFields,
  type Cadence,
  type GoalKind,
  type NotifyChannel,
} from "@/lib/watchGoals";

interface Props {
  goalId: string;
  filters: any;
  cadence: string;
  onFiltersChange: (filters: any) => void;
  onCadenceChange: (cadence: Cadence) => void;
}

const THRESHOLDS = [5, 6, 7, 8, 9];

export function WatchGoalControls({
  goalId,
  filters,
  cadence,
  onFiltersChange,
  onCadenceChange,
}: Props) {
  const { toast } = useToast();
  const fields = readGoalFields(filters);
  const [saving, setSaving] = useState(false);

  const patch = async (
    p: Partial<{ matchThreshold: number; notify: NotifyChannel; goalKind: GoalKind }>,
    successMessage: string,
  ) => {
    setSaving(true);
    const result = await updateGoalFields(goalId, filters, p);
    setSaving(false);
    if (!result.ok) {
      toast({ title: "Could not save", description: result.error, variant: "destructive" });
      return;
    }
    onFiltersChange(result.filters);
    toast({ title: "Watch goal updated", description: successMessage });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-lg border bg-muted/40">
      <div className="space-y-1.5">
        <Label htmlFor={`kind-${goalId}`} className="text-xs">What to watch</Label>
        <Select
          value={fields.goalKind}
          disabled={saving}
          onValueChange={(v) => patch({ goalKind: v as GoalKind }, GOAL_KIND_LABEL[v as GoalKind])}
        >
          <SelectTrigger id={`kind-${goalId}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(GOAL_KIND_LABEL) as GoalKind[]).map((k) => (
              <SelectItem key={k} value={k}>
                {GOAL_KIND_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`threshold-${goalId}`} className="text-xs">
          Tell me when the Match Score is at least
        </Label>
        <Select
          value={String(fields.matchThreshold)}
          disabled={saving}
          onValueChange={(v) => patch({ matchThreshold: Number(v) }, `Threshold set to ${v}/10`)}
        >
          <SelectTrigger id={`threshold-${goalId}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {THRESHOLDS.map((t) => (
              <SelectItem key={t} value={String(t)}>
                {t}/10
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`notify-${goalId}`} className="text-xs">How to notify me</Label>
        <Select
          value={fields.notify}
          disabled={saving}
          onValueChange={(v) =>
            patch({ notify: v as NotifyChannel }, NOTIFY_LABEL[v as NotifyChannel])
          }
        >
          <SelectTrigger id={`notify-${goalId}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(NOTIFY_LABEL) as NotifyChannel[]).map((n) => (
              <SelectItem key={n} value={n}>
                {NOTIFY_LABEL[n]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`cadence-${goalId}`} className="text-xs">How often to check</Label>
        <Select value={cadence === "daily" ? "daily" : "weekly"} onValueChange={(v) => onCadenceChange(v as Cadence)}>
          <SelectTrigger id={`cadence-${goalId}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

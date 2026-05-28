import type { ComposedCard } from '@/lib/investorBrief/types';
import { BriefCardRenderer } from '../BriefCardRenderer';

/**
 * Renders the source card's visual at "deepDive" density inside the
 * right-hand panel when a user enters Deep Dive mode. Today this wraps
 * the existing card renderer in a sized container; per-card density
 * variants can be added later without changing this surface.
 */
export function SourceCardVisual({ card }: { card: ComposedCard }) {
  return (
    <div
      data-density="deepDive"
      className="[&_.recharts-wrapper]:!h-[280px] [&_.recharts-responsive-container]:!h-[280px]"
    >
      <BriefCardRenderer card={card} userId={null} />
    </div>
  );
}
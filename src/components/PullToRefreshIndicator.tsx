import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold = 80,
}: PullToRefreshIndicatorProps) {
  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 360;
  const opacity = Math.min(progress * 1.5, 1);
  
  if (pullDistance <= 0 && !isRefreshing) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{
        transform: `translateY(${Math.min(pullDistance, threshold)}px)`,
        transition: isRefreshing ? 'none' : 'transform 0.2s ease-out',
      }}
    >
      <div
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full bg-background border shadow-lg",
          isRefreshing && "animate-spin"
        )}
        style={{
          opacity,
          transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
        }}
      >
        <RefreshCw 
          className={cn(
            "h-5 w-5 text-primary",
            progress >= 1 && "text-secondary"
          )} 
        />
      </div>
    </div>
  );
}

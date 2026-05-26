import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Bookmark,
  Calculator as CalcIcon,
  Pin,
  Settings,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConsoleSidebarProps {
  expanded?: boolean;
}

const items = [
  { to: '/investor', icon: LayoutDashboard, label: 'Brief', end: true },
  { to: '/saved-analyses', icon: Bookmark, label: 'Saved analyses' },
  { to: '/investor/calculator', icon: CalcIcon, label: 'Calculator' },
  { to: '/profile-setup', icon: Settings, label: 'Preferences' },
];

export function ConsoleSidebar({ expanded = false }: ConsoleSidebarProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  return (
    <>
      {/* Desktop: vertical rail */}
      <aside
        className={cn(
          'hidden lg:flex flex-col shrink-0 border-r bg-card/40 backdrop-blur-sm',
          expanded ? 'w-56' : 'w-14',
        )}
      >
        <nav className="flex-1 py-4 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 mx-2 px-2 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
              title={expanded ? undefined : item.label}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {expanded && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        {expanded && (
          <div className="p-3 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-2 mb-1 text-foreground/80">
              <Pin className="h-3.5 w-3.5" /> Talking points
            </div>
            <p className="text-[11px] leading-snug">Pin insights from your brief to reference here.</p>
          </div>
        )}
      </aside>

      {/* Mobile + tablet: collapsible vertical mini rail (expands as overlay) */}
      <aside
        className={cn(
          'lg:hidden sticky top-16 self-start z-30 shrink-0 border-r bg-card/95 backdrop-blur-md flex flex-col transition-[width] duration-200',
          mobileExpanded ? 'w-56' : 'w-12',
        )}
        style={{ height: 'calc(100vh - 4rem)' }}
        aria-label="Investor sections"
      >
        <button
          type="button"
          onClick={() => setMobileExpanded((v) => !v)}
          className="flex items-center justify-end gap-2 px-2 py-2 border-b text-muted-foreground hover:text-foreground touch-manipulation"
          aria-label={mobileExpanded ? 'Collapse menu' : 'Expand menu'}
        >
          {mobileExpanded ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <nav className="flex-1 py-2 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileExpanded(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 mx-1 px-2 min-h-11 rounded-md text-sm transition-colors touch-manipulation',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
              title={mobileExpanded ? undefined : item.label}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {mobileExpanded && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}

import { NavLink } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, Bookmark, Scale, Calculator as CalcIcon, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConsoleSidebarProps {
  expanded?: boolean;
}

const items = [
  { to: '/investor', icon: LayoutDashboard, label: 'Brief', end: true },
  { to: '/investor/console', icon: MessageSquare, label: 'Console' },
  { to: '/saved-analyses', icon: Bookmark, label: 'Saved analyses' },
  { to: '/compare', icon: Scale, label: 'Comparator' },
  { to: '/investor/calculator', icon: CalcIcon, label: 'Calculator' },
];

export function ConsoleSidebar({ expanded = false }: ConsoleSidebarProps) {
  return (
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
  );
}

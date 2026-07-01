import { Link, useNavigate } from "react-router-dom";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { FEATURES, SOLUTIONS } from "./featureRegistry";

export function PublicNav() {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Features</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[720px] grid-cols-2 gap-2 p-4">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <li key={f.slug}>
                    <NavigationMenuLink asChild>
                      <Link
                        to={`/features/${f.slug}`}
                        className="flex gap-3 rounded-md p-3 hover:bg-accent hover:text-accent-foreground focus:bg-accent"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold leading-tight">
                            {f.name}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground leading-snug">
                            {f.short}
                          </span>
                        </span>
                      </Link>
                    </NavigationMenuLink>
                  </li>
                );
              })}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuTrigger>Solutions</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[420px] gap-2 p-4">
              {SOLUTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <li key={s.slug}>
                    <NavigationMenuLink asChild>
                      <Link
                        to={`/solutions/${s.slug}`}
                        className="flex gap-3 rounded-md p-3 hover:bg-accent hover:text-accent-foreground focus:bg-accent"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold leading-tight">
                            {s.name}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground leading-snug">
                            {s.short}
                          </span>
                        </span>
                      </Link>
                    </NavigationMenuLink>
                  </li>
                );
              })}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuLink asChild className={cn(navigationMenuTriggerStyle())}>
            <Link to="/pricing">Pricing</Link>
          </NavigationMenuLink>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuLink asChild className={cn(navigationMenuTriggerStyle())}>
            <Link to="/faq">FAQ</Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

export function PublicNavMobile({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const go = (path: string) => {
    onNavigate?.();
    navigate(path);
  };
  return (
    <div className="space-y-4">
      <div>
        <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Features
        </div>
        <div className="space-y-1">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.slug}
                onClick={() => go(`/features/${f.slug}`)}
                className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-accent"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-tight">{f.name}</span>
                  <span className="block text-xs text-muted-foreground leading-snug">
                    {f.short}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Solutions
        </div>
        <div className="space-y-1">
          {SOLUTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.slug}
                onClick={() => go(`/solutions/${s.slug}`)}
                className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-accent"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-tight">{s.name}</span>
                  <span className="block text-xs text-muted-foreground leading-snug">
                    {s.short}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <button
          onClick={() => go("/pricing")}
          className="flex w-full rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-accent"
        >
          Pricing
        </button>
        <button
          onClick={() => go("/faq")}
          className="flex w-full rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-accent"
        >
          FAQ
        </button>
      </div>
    </div>
  );
}
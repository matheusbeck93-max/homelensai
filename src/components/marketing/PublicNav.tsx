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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
                        className="group flex gap-3 rounded-md p-3 hover:bg-accent focus:bg-accent"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground group-focus:bg-primary group-focus:text-primary-foreground">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold leading-tight text-foreground group-hover:text-accent-foreground group-focus:text-accent-foreground">
                            {f.name}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground leading-snug group-hover:text-accent-foreground/90 group-focus:text-accent-foreground/90">
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
                        className="group flex gap-3 rounded-md p-3 hover:bg-accent focus:bg-accent"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground group-focus:bg-primary group-focus:text-primary-foreground">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold leading-tight text-foreground group-hover:text-accent-foreground group-focus:text-accent-foreground">
                            {s.name}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground leading-snug group-hover:text-accent-foreground/90 group-focus:text-accent-foreground/90">
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
    <div className="space-y-2">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="features" className="border-b">
          <AccordionTrigger className="px-3 py-3 text-sm font-medium hover:no-underline">
            Features
          </AccordionTrigger>
          <AccordionContent className="pb-2">
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
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="solutions" className="border-b">
          <AccordionTrigger className="px-3 py-3 text-sm font-medium hover:no-underline">
            Solutions
          </AccordionTrigger>
          <AccordionContent className="pb-2">
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="space-y-1">
        <button
          onClick={() => go("/pricing")}
          className="flex w-full rounded-md px-3 py-3 text-left text-sm font-medium hover:bg-accent"
        >
          Pricing
        </button>
        <button
          onClick={() => go("/faq")}
          className="flex w-full rounded-md px-3 py-3 text-left text-sm font-medium hover:bg-accent"
        >
          FAQ
        </button>
      </div>
    </div>
  );
}
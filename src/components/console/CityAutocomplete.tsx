import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { US_STATES } from "@/data/usStatesCities";

interface CityOption {
  city: string;
  state: string; // 2-letter code
  stateName: string;
}

const ALL_CITIES: CityOption[] = US_STATES.flatMap((s) =>
  s.cities.map((c) => ({ city: c, state: s.code, stateName: s.name }))
);

interface Props {
  city: string;
  state: string;
  onChange: (city: string, state: string) => void;
}

export function CityAutocomplete({ city, state, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const label = city
    ? state
      ? `${city}, ${state.toUpperCase()}`
      : city
    : "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_CITIES.slice(0, 50);
    return ALL_CITIES.filter(
      (o) =>
        o.city.toLowerCase().includes(q) ||
        o.state.toLowerCase() === q ||
        o.stateName.toLowerCase().includes(q)
    ).slice(0, 80);
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="flex-1 justify-between font-normal"
        >
          <span className={cn(!label && "text-muted-foreground")}>
            {label || "Search a city..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-popover z-50" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type a city or state..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {query.trim() ? (
                <button
                  type="button"
                  className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded"
                  onClick={() => {
                    onChange(query.trim(), state);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  Use "{query.trim()}" as custom city
                </button>
              ) : (
                <span className="text-sm text-muted-foreground">No match</span>
              )}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((o) => {
                const selected = o.city === city && o.state === state.toUpperCase();
                return (
                  <CommandItem
                    key={`${o.city}-${o.state}`}
                    value={`${o.city}, ${o.state}`}
                    onSelect={() => {
                      onChange(o.city, o.state);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                    {o.city}, {o.state}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
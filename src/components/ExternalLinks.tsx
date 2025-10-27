import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { externalSites } from "@/lib/externalLinks";

interface ExternalLinksProps {
  property: {
    address: string;
    city: string;
    state: string;
    zip?: string;
  };
}

export function ExternalLinks({ property }: ExternalLinksProps) {
  return (
    <div className="border rounded-lg p-6 bg-card">
      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <ExternalLink className="h-5 w-5" />
        Ver em outros sites
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {externalSites.map((site) => (
          <Button
            key={site.name}
            variant="outline"
            asChild
            className="w-full"
          >
            <a
              href={site.generator(property)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              {site.name}
            </a>
          </Button>
        ))}
      </div>
    </div>
  );
}

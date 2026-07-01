import { Link } from "react-router-dom";
import { Home, type LucideIcon } from "lucide-react";
import { FEATURES_BY_SLUG, SOLUTIONS } from "@/components/marketing/featureRegistry";

type FooterLink = { to: string; label: string; external?: boolean; icon?: LucideIcon };

const columns: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { to: "/features", label: "Features" },
      { to: "/solutions", label: "Solutions" },
      { to: "/pricing", label: "Pricing" },
      { to: "/features/calculators", label: "Calculators", icon: FEATURES_BY_SLUG["calculators"].icon },
      { to: "/features/chrome-extension", label: "Chrome Extension", icon: FEATURES_BY_SLUG["chrome-extension"].icon },
      { to: "/features/investor-brief", label: "Investor Brief", icon: FEATURES_BY_SLUG["investor-brief"].icon },
    ],
  },
  {
    title: "Company",
    links: [
      { to: "/blog", label: "Blog" },
      { to: "/faq", label: "FAQ" },
      { to: "mailto:h2@homelens-ai.com", label: "Support", external: true },
    ],
  },
  {
    title: "Resources",
    links: [
      { to: "/solutions/buyer", label: "Buyer Plan", icon: SOLUTIONS.find((s) => s.slug === "buyer")?.icon },
      { to: "/solutions/investor", label: "Investor Plan", icon: SOLUTIONS.find((s) => s.slug === "investor")?.icon },
    ],
  },
  {
    title: "Legal",
    links: [
      { to: "/terms", label: "Terms of Service" },
      { to: "/privacy", label: "Privacy Policy" },
      { to: "/cookies", label: "Cookie Policy" },
      { to: "/fair-housing", label: "Fair Housing" },
      { to: "/accessibility", label: "Accessibility" },
      { to: "/ccpa", label: "CCPA Notice" },
      { to: "/dmca", label: "DMCA Policy" },
      { to: "/do-not-sell", label: "Do Not Sell" },
    ],
  },
];

function FooterLinkItem({ link }: { link: FooterLink }) {
  const Icon = link.icon;
  const cls = "inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors";
  const content = (
    <>
      {Icon && <Icon className="h-4 w-4 text-slate-400" />}
      <span>{link.label}</span>
    </>
  );
  return link.external ? (
    <a href={link.to} className={cls}>
      {content}
    </a>
  ) : (
    <Link to={link.to} className={cls}>
      {content}
    </Link>
  );
}

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-200 mt-auto">
      <div className="container max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
          <div className="md:col-span-1">
            <Link to="/" className="inline-flex items-center gap-2 text-white">
              <Home className="h-5 w-5" strokeWidth={1.5} />
              <span className="text-lg font-semibold tracking-tight">HomeLens</span>
            </Link>
            <p className="mt-3 text-xs text-slate-400 leading-relaxed">
              Big decisions deserve the full picture.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-white mb-4">{col.title}</h3>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.to + link.label}>
                    <FooterLinkItem link={link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Security &amp; Privacy
            </span>
            <Link to="/privacy" className="text-xs text-slate-400 hover:text-white transition-colors">
              Learn more
            </Link>
          </div>
          <p className="text-xs text-slate-400">
            &copy; {new Date().getFullYear()} Homelens.ai LLC. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

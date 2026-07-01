import {
  MessageSquare,
  Calculator,
  TrendingUp,
  LineChart,
  BookmarkCheck,
  Home,
  SlidersHorizontal,
  ScanSearch,
  Chrome,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import chatAsset from "@/assets/chat-feature-real.png.asset.json";
import buyingPowerAsset from "@/assets/buying-power-real.jpg.asset.json";
import investorAsset from "@/assets/investor-home.jpg.asset.json";
import chromeAsset from "@/assets/chrome-ext-home.jpg.asset.json";
import savedAnalysesAsset from "@/assets/saved-analyses.png.asset.json";
import myPropertiesAsset from "@/assets/my-properties.png.asset.json";
import preferencesAsset from "@/assets/preferences.png.asset.json";
import investorBriefAsset from "@/assets/investor-brief.png.asset.json";

export type FeatureSlug =
  | "chrome-extension"
  | "ai-chat"
  | "buying-power"
  | "investor-brief"
  | "investor-calculator"
  | "saved-analyses"
  | "my-properties"
  | "preferences"
  | "property-analysis"
  | "calculators";

export type FeatureDef = {
  slug: FeatureSlug;
  name: string;
  short: string;
  headline: string;
  subheadline: string;
  icon: LucideIcon;
  screenshot?: string;
  screenshotAlt?: string;
  benefits: { title: string; body: string }[];
};

export const FEATURES: FeatureDef[] = [
  {
    slug: "chrome-extension",
    name: "Chrome Extension",
    short: "Analyze any Zillow or Redfin listing without leaving the page.",
    headline: "HomeLens where you already shop for homes.",
    subheadline:
      "Get an instant AI analysis, personalized match score, and macro market signals injected right into Zillow, Redfin, and Realtor.com.",
    icon: Chrome,
    screenshot: chromeAsset.url,
    screenshotAlt: "HomeLens Chrome extension analyzing a Zillow listing",
    benefits: [
      { title: "One-click analysis", body: "A HomeLens button appears on every listing. Click it and get the full decision picture without switching tabs." },
      { title: "Personalized match score", body: "Every property is scored 0–10 against your profile so you can skip the ones that don't fit." },
      { title: "Macro market badge", body: "See labor, wage growth, and building permit signals for the metro right on the listing page." },
    ],
  },
  {
    slug: "ai-chat",
    name: "AI Chat",
    short: "Ask anything about a property, market, or your financial picture.",
    headline: "A real estate analyst in your pocket.",
    subheadline:
      "Paste a listing, describe a market, or ask a scenario question. HomeLens combines your profile, live market data, and financial modeling to answer clearly.",
    icon: MessageSquare,
    screenshot: chatAsset.url,
    screenshotAlt: "HomeLens AI chat answering a property question",
    benefits: [
      { title: "Decision-first answers", body: "Every response opens with a clear yes/no/likely take — no wall of caveats to wade through." },
      { title: "Grounded in real data", body: "Live listings, mortgage rates, taxes, schools, and neighborhood stats are pulled in automatically." },
      { title: "Context that follows you", body: "Your preferences, saved analyses, and previous chats stay in memory across sessions." },
    ],
  },
  {
    slug: "buying-power",
    name: "Buying Power Calculator",
    short: "Know exactly how much home you can actually afford.",
    headline: "Your real number, not a bank's max.",
    subheadline:
      "Enter your income, debts, and savings. HomeLens shows the price range that keeps you comfortable — and the one that stretches you.",
    icon: Calculator,
    screenshot: buyingPowerAsset.url,
    screenshotAlt: "HomeLens Buying Power calculator showing an affordability range",
    benefits: [
      { title: "Two ranges, not one", body: "See both the safe number and the max-approval number so you can decide where you want to live in that gap." },
      { title: "Real closing costs", body: "Down payment, PMI, taxes, insurance, and closing fees are all modeled — not hand-waved." },
      { title: "Rate-aware", body: "Live mortgage rates from FRED so the payment estimate matches what a lender would quote you today." },
    ],
  },
  {
    slug: "investor-brief",
    name: "Investor Brief",
    short: "A full market brief with macro signals and deal filters.",
    headline: "Institutional-grade briefs for individual investors.",
    subheadline:
      "Labor market health, wage growth, permits, rate trajectory, and rental yield — synthesized into a brief that tells you where to look and where to walk away.",
    icon: TrendingUp,
    screenshot: investorBriefAsset.url,
    screenshotAlt: "HomeLens Investor Brief dashboard",
    benefits: [
      { title: "Macro + micro in one view", body: "FRED, BLS, and Census data joined with property-level economics for the metros you care about." },
      { title: "Deep-dive starters", body: "Every insight ends with a set of one-click deeper questions so you can pressure-test the thesis." },
      { title: "Save briefs to your library", body: "Every brief is saved and time-stamped so you can watch a metro's story evolve." },
    ],
  },
  {
    slug: "investor-calculator",
    name: "Investor Calculator",
    short: "Model any deal — cap rate, cash-on-cash, IRR, tax treatment.",
    headline: "The deal math, done right.",
    subheadline:
      "Simple mode for quick screens, advanced mode for real underwriting. State and federal capital gains are separated, PMI is automatic, and every assumption is exposed.",
    icon: LineChart,
    screenshot: buyingPowerAsset.url,
    screenshotAlt: "HomeLens Investor Calculator underwriting a deal",
    benefits: [
      { title: "Simple and advanced modes", body: "Start with a quick cap-rate check, then flip to advanced when the deal deserves real underwriting." },
      { title: "Tax-aware exits", body: "Federal and state capital gains modeled separately, plus depreciation recapture and 1031 scenarios." },
      { title: "Chat with your numbers", body: "Ask the AI to explain, sanity-check, or optimize any assumption in the calculator." },
    ],
  },
  {
    slug: "saved-analyses",
    name: "Saved Analyses",
    short: "Every property you've analyzed, kept and comparable.",
    headline: "A shortlist you can actually reason about.",
    subheadline:
      "Save AI analyses from the app or the Chrome extension. Each one keeps its match score, snapshot, and full chat history — ready to compare.",
    icon: BookmarkCheck,
    screenshot: savedAnalysesAsset.url,
    screenshotAlt: "HomeLens Saved Analyses library with match scores",
    benefits: [
      { title: "Auto-scored library", body: "Every save is tagged with its match score so the shortlist naturally sorts by fit." },
      { title: "Full context preserved", body: "Property snapshot, financial breakdown, and the full analysis chat — all saved together." },
      { title: "Compare side by side", body: "Pull any two saved properties into the compare view and let AI narrate the trade-offs." },
    ],
  },
  {
    slug: "my-properties",
    name: "My Properties",
    short: "Track the homes you already own like a portfolio.",
    headline: "Your real estate portfolio, always current.",
    subheadline:
      "Track equity, rental yield, expenses, and Schedule E figures for every property you own. Rentcast pulls live valuations so your net worth stays honest.",
    icon: Home,
    screenshot: myPropertiesAsset.url,
    screenshotAlt: "HomeLens My Properties portfolio dashboard",
    benefits: [
      { title: "Live valuations", body: "Automatic Rentcast-backed refreshes keep every property's estimated value current." },
      { title: "Schedule E ready", body: "Rental income, expenses, and depreciation exported in a format your accountant will thank you for." },
      { title: "Portfolio-level view", body: "Total equity, cash flow, and appreciation summarized across every property you own." },
    ],
  },
  {
    slug: "preferences",
    name: "Set Preferences",
    short: "Tell HomeLens what matters so every answer is personalized.",
    headline: "One profile. Every answer, tailored.",
    subheadline:
      "Your goals, budget, cities, buyer type, and priorities are woven into every match score, chat answer, and brief — automatically.",
    icon: SlidersHorizontal,
    screenshot: preferencesAsset.url,
    screenshotAlt: "HomeLens Preferences setup with conversational assistant",
    benefits: [
      { title: "Multi-city, multi-goal", body: "Track several target markets and multiple goals (buy, invest, house-hack) at the same time." },
      { title: "Free-form context", body: "The 'About me' field lets you add nuance a form can't capture — the AI reads it every turn." },
      { title: "Live everywhere", body: "Change a preference once and every score, brief, and chat updates on the next request." },
    ],
  },
  {
    slug: "property-analysis",
    name: "Property Analysis",
    short: "Paste any listing URL — get the full decision picture.",
    headline: "From listing URL to decision in seconds.",
    subheadline:
      "Financial fit, market context, fair-price indicator, neighborhood stats, flood risk, and a personalized match score — all from a single link.",
    icon: ScanSearch,
    screenshot: chatAsset.url,
    screenshotAlt: "HomeLens property analysis with match score and financials",
    benefits: [
      { title: "Fair-price indicator", body: "Every listing is checked against Zestimate and comparable sales to flag over- and under-priced homes." },
      { title: "Neighborhood at a glance", body: "Schools, crime trends, walkability, and local price direction summarized in plain English." },
      { title: "Flood and tax risk", body: "State property tax data and FEMA flood zone are joined so you never get surprised at closing." },
    ],
  },
];

export const FEATURES_BY_SLUG = Object.fromEntries(
  FEATURES.map((f) => [f.slug, f])
) as Record<FeatureSlug, FeatureDef>;

export type SolutionDef = {
  slug: "buyer" | "investor";
  name: string;
  short: string;
  icon: LucideIcon;
};

export const SOLUTIONS: SolutionDef[] = [
  {
    slug: "buyer",
    name: "Buyer Plan",
    short: "Buy your next home with confidence — clarity on affordability, fit, and long-term cost.",
    icon: Home,
  },
  {
    slug: "investor",
    name: "Investor Plan",
    short: "Underwrite deals, track your portfolio, and read the macro signals that move markets.",
    icon: Briefcase,
  },
];
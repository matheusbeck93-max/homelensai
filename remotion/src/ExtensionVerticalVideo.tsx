import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { VerticalBackground } from "./components/VerticalBackground";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const COLORS = {
  primary: "#6B8DB5",
  primaryLight: "#8AADD0",
  primaryDark: "#4A6E94",
  accent: "#A3C4E0",
  dark: "#2C3E55",
  darkMid: "#3A5068",
  white: "#FFFFFF",
  offWhite: "#F0F4F8",
  muted: "#B0C4D8",
  mutedDark: "#7A95AD",
  success: "#4CAF7A",
  warn: "#E8B84A",
  danger: "#E07A6B",
  zillow: "#006AFF",
};

// --- Reusable cursor
const Cursor = ({ x, y, click = 0 }: { x: number; y: number; click?: number }) => (
  <div style={{ position: "absolute", left: x, top: y, transform: "translate(-4px,-2px)", pointerEvents: "none" }}>
    {click > 0 && (
      <div
        style={{
          position: "absolute",
          left: -20,
          top: -20,
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: `3px solid ${COLORS.primaryLight}`,
          opacity: 1 - click,
          transform: `scale(${0.5 + click * 1.6})`,
        }}
      />
    )}
    <svg width="34" height="42" viewBox="0 0 24 30">
      <path d="M2 2 L2 22 L7 17 L10 24 L13 23 L10 16 L17 16 Z" fill="#fff" stroke="#111" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  </div>
);

// --- Browser chrome frame containing children
const BrowserFrame = ({
  url,
  showExtBadge,
  extPulse,
  children,
}: {
  url: string;
  showExtBadge: number;
  extPulse: number;
  children: React.ReactNode;
}) => (
  <div
    style={{
      width: 940,
      borderRadius: 22,
      overflow: "hidden",
      boxShadow: "0 40px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(163,196,224,0.15)",
      background: COLORS.white,
    }}
  >
    {/* Title bar */}
    <div style={{ background: "#E8ECEF", padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#FF5F57" }} />
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#FEBC2E" }} />
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#28C840" }} />
      </div>
      <div
        style={{
          flex: 1,
          background: "#fff",
          borderRadius: 10,
          padding: "8px 14px",
          fontSize: 18,
          color: "#555",
          fontFamily: "monospace",
          border: "1px solid #D6DBDF",
        }}
      >
        {url}
      </div>
      {/* Extension icon in toolbar */}
      <div
        style={{
          position: "relative",
          width: 44,
          height: 44,
          borderRadius: 10,
          background: showExtBadge > 0 ? "rgba(107,141,181,0.15)" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "none",
        }}
      >
        <Img
          src={staticFile("images/extension-icon.png")}
          style={{ width: 32, height: 32, objectFit: "contain", opacity: 0.35 + showExtBadge * 0.65 }}
        />
        {extPulse > 0 && (
          <div
            style={{
              position: "absolute",
              inset: -6,
              borderRadius: 14,
              border: `3px solid ${COLORS.primary}`,
              opacity: 1 - extPulse,
              transform: `scale(${1 + extPulse * 0.5})`,
            }}
          />
        )}
      </div>
    </div>
    {children}
  </div>
);

// --- Fake Zillow-ish listing content
const ListingBody = ({ scrollY = 0 }: { scrollY?: number }) => (
  <div style={{ height: 1100, overflow: "hidden", background: "#fff" }}>
    <div style={{ transform: `translateY(${-scrollY}px)` }}>
      {/* Photo */}
      <div
        style={{
          height: 480,
          background:
            "linear-gradient(135deg, #B8C9D9 0%, #7A95AD 60%, #4A6E94 100%)",
          position: "relative",
        }}
      >
        {/* House silhouette */}
        <svg viewBox="0 0 400 260" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.35 }}>
          <path d="M50 200 L50 130 L200 40 L350 130 L350 200 Z" fill="#fff" />
          <rect x="170" y="150" width="60" height="50" fill="#2C3E55" />
          <rect x="80" y="140" width="50" height="40" fill="#2C3E55" />
          <rect x="270" y="140" width="50" height="40" fill="#2C3E55" />
        </svg>
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            padding: "8px 14px",
            background: "rgba(0,0,0,0.55)",
            color: "#fff",
            borderRadius: 6,
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          FOR SALE
        </div>
      </div>
      <div style={{ padding: "28px 36px", fontFamily }}>
        <div style={{ fontSize: 44, fontWeight: 700, color: "#1F2A37" }}>$685,000</div>
        <div style={{ fontSize: 20, color: "#4A5568", marginTop: 4 }}>3 bd · 2 ba · 1,840 sqft</div>
        <div style={{ fontSize: 20, color: "#4A5568", marginTop: 8 }}>2438 Maple Ave, Austin, TX 78704</div>
        <div style={{ marginTop: 22, display: "flex", gap: 10 }}>
          <div style={{ padding: "12px 22px", background: COLORS.zillow, color: "#fff", borderRadius: 8, fontWeight: 600, fontSize: 18 }}>
            Request a tour
          </div>
          <div style={{ padding: "12px 22px", background: "#F0F4F8", color: "#1F2A37", borderRadius: 8, fontWeight: 600, fontSize: 18, border: "1px solid #D6DBDF" }}>
            Contact agent
          </div>
        </div>
        <div style={{ marginTop: 34, fontSize: 22, fontWeight: 700, color: "#1F2A37" }}>Overview</div>
        <div style={{ marginTop: 12, fontSize: 18, color: "#4A5568", lineHeight: 1.5 }}>
          Charming single-family home with updated kitchen, hardwood floors, and a spacious backyard.
          Located in a quiet, tree-lined street just minutes from downtown Austin.
        </div>
        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            ["Year built", "1998"],
            ["Lot size", "7,200 sqft"],
            ["HOA", "None"],
            ["Property tax", "$8,940 / yr"],
          ].map(([k, v]) => (
            <div key={k} style={{ background: "#F7F9FB", padding: "14px 16px", borderRadius: 10 }}>
              <div style={{ fontSize: 14, color: "#7A8899", textTransform: "uppercase", letterSpacing: 1 }}>{k}</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#1F2A37", marginTop: 4 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// --- Slide-in HomeLens side panel with AI results
const HomeLensPanel = ({ progress, revealScore, revealItems }: { progress: number; revealScore: number; revealItems: number[] }) => (
  <div
    style={{
      position: "absolute",
      top: 60,
      right: 40,
      width: 460,
      background: "#0F1B2A",
      borderRadius: 20,
      padding: 26,
      color: "#fff",
      fontFamily,
      transform: `translateX(${(1 - progress) * 520}px)`,
      opacity: progress,
      boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
      border: `1px solid rgba(163,196,224,0.2)`,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Img src={staticFile("images/extension-icon.png")} style={{ width: 32, height: 32 }} />
      <div style={{ fontSize: 20, fontWeight: 700 }}>HomeLens AI</div>
      <div
        style={{
          marginLeft: "auto",
          fontSize: 12,
          color: COLORS.accent,
          background: "rgba(163,196,224,0.15)",
          padding: "4px 10px",
          borderRadius: 999,
          letterSpacing: 1,
        }}
      >
        ANALYZING
      </div>
    </div>

    {/* Match score circle */}
    <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 18, opacity: revealScore }}>
      <div
        style={{
          width: 92,
          height: 92,
          borderRadius: "50%",
          background: `conic-gradient(${COLORS.success} ${revealScore * 306}deg, rgba(255,255,255,0.08) 0deg)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 74,
            height: 74,
            borderRadius: "50%",
            background: "#0F1B2A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          {Math.round(revealScore * 8.5 * 10) / 10}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 14, color: COLORS.muted, letterSpacing: 1, textTransform: "uppercase" }}>Match score</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.success, marginTop: 4 }}>Strong buy</div>
      </div>
    </div>

    {/* Insight rows */}
    <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 12 }}>
      {[
        { color: COLORS.success, icon: "↑", label: "Priced 4% below Zestimate" },
        { color: COLORS.success, icon: "★", label: "Schools rated 8/10 · walkable area" },
        { color: COLORS.warn, icon: "!", label: "Property tax above metro median" },
        { color: COLORS.success, icon: "◆", label: "Est. rent yield 5.8% · cash-flow positive" },
      ].map((item, i) => {
        const op = revealItems[i] ?? 0;
        return (
          <div
            key={i}
            style={{
              opacity: op,
              transform: `translateX(${(1 - op) * 20}px)`,
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "rgba(255,255,255,0.04)",
              padding: "12px 14px",
              borderRadius: 12,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: item.color,
                color: "#0F1B2A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              {item.icon}
            </div>
            <div style={{ fontSize: 15, color: "#E8EEF5" }}>{item.label}</div>
          </div>
        );
      })}
    </div>
  </div>
);

// ============ SCENE 1: HOOK ============
const SHook = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeOut = interpolate(frame, [65, 79], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const l1 = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const l1Y = interpolate(spring({ frame, fps, config: { damping: 18 } }), [0, 1], [40, 0]);
  const l2 = interpolate(frame, [22, 40], [0, 1], { extrapolateRight: "clamp" });
  const l2Y = interpolate(spring({ frame: frame - 22, fps, config: { damping: 18 } }), [0, 1], [40, 0]);

  return (
    <AbsoluteFill style={{ fontFamily, opacity: fadeOut, justifyContent: "center", alignItems: "center", padding: "0 60px", textAlign: "center" }}>
      <div style={{ opacity: l1, transform: `translateY(${l1Y}px)`, fontSize: 28, color: COLORS.muted, fontWeight: 500, marginBottom: 22, letterSpacing: 2, textTransform: "uppercase" }}>
        You found a house.
      </div>
      <div style={{ opacity: l2, transform: `translateY(${l2Y}px)`, fontSize: 96, fontWeight: 700, color: COLORS.white, lineHeight: 1, letterSpacing: -3 }}>
        Now what?
      </div>
    </AbsoluteFill>
  );
};

// ============ SCENE 2: Browsing simulation ============
const SBrowse = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [125, 149], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Cursor wanders on the listing
  const cx = interpolate(frame, [10, 60, 100, 145], [500, 700, 400, 780], { extrapolateRight: "clamp" });
  const cy = interpolate(frame, [10, 60, 100, 145], [900, 1050, 1250, 900], { extrapolateRight: "clamp" });
  const scrollY = interpolate(frame, [40, 120], [0, 180], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const captionOp = interpolate(frame, [20, 40, 110, 130], [0, 1, 1, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, opacity: fadeIn * fadeOut, alignItems: "center" }}>
      <div style={{ marginTop: 220, opacity: captionOp, fontSize: 40, fontWeight: 700, color: COLORS.white, textAlign: "center", padding: "0 60px", lineHeight: 1.15, letterSpacing: -1 }}>
        Is it a good deal?
      </div>
      <div style={{ position: "absolute", top: 360, left: "50%", transform: "translateX(-50%)" }}>
        <BrowserFrame url="zillow.com/homedetails/2438-maple-ave" showExtBadge={0} extPulse={0}>
          <ListingBody scrollY={scrollY} />
        </BrowserFrame>
      </div>
      <Cursor x={540 + cx * 0.5} y={cy} />
    </AbsoluteFill>
  );
};

// ============ SCENE 3: Click extension icon ============
const SClick = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [140, 159], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Cursor moves toward extension icon (top-right of browser frame ~ x=1385, y=390)
  const cx = interpolate(frame, [0, 45], [850, 1400], { extrapolateRight: "clamp" });
  const cy = interpolate(frame, [0, 45], [1000, 400], { extrapolateRight: "clamp" });
  const clickWave = interpolate(frame, [45, 65], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const iconGlow = interpolate(frame, [30, 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const panel = spring({ frame: frame - 55, fps, config: { damping: 18, stiffness: 120 } });

  const revealScore = interpolate(frame, [80, 115], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const revealItems = [90, 100, 110, 120].map((s) =>
    interpolate(frame, [s, s + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );

  const captionOp = interpolate(frame, [10, 30, 55, 70], [0, 1, 1, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, opacity: fadeIn * fadeOut, alignItems: "center" }}>
      <div style={{ marginTop: 220, opacity: captionOp, fontSize: 38, fontWeight: 700, color: COLORS.white, textAlign: "center", padding: "0 60px", lineHeight: 1.15, letterSpacing: -1 }}>
        One click. Instant answer.
      </div>
      <div style={{ position: "absolute", top: 360, left: "50%", transform: "translateX(-50%)" }}>
        <BrowserFrame url="zillow.com/homedetails/2438-maple-ave" showExtBadge={iconGlow} extPulse={clickWave}>
          <ListingBody scrollY={180} />
        </BrowserFrame>
      </div>
      <div style={{ position: "absolute", top: 360, left: "50%", transform: "translateX(-50%)", width: 940 }}>
        <HomeLensPanel progress={panel} revealScore={revealScore} revealItems={revealItems} />
      </div>
      <Cursor x={cx} y={cy} click={clickWave} />
    </AbsoluteFill>
  );
};

// ============ SCENE 4: Works everywhere ============
const SWorks = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [95, 114], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const sites = ["Zillow", "Redfin", "Realtor.com", "Trulia", "Homes.com"];
  const titleY = interpolate(spring({ frame, fps, config: { damping: 18 } }), [0, 1], [30, 0]);

  return (
    <AbsoluteFill style={{ fontFamily, opacity: fadeIn * fadeOut, alignItems: "center", justifyContent: "center", padding: "0 60px", textAlign: "center" }}>
      <div style={{ fontSize: 26, color: COLORS.accent, fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", transform: `translateY(${titleY}px)` }}>
        Works everywhere
      </div>
      <div style={{ marginTop: 24, fontSize: 68, fontWeight: 700, color: COLORS.white, lineHeight: 1.05, letterSpacing: -2 }}>
        you shop for{"\n"}homes.
      </div>
      <div style={{ marginTop: 60, display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 720 }}>
        {sites.map((s, i) => {
          const start = 20 + i * 10;
          const op = interpolate(frame, [start, start + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const y = interpolate(op, [0, 1], [20, 0]);
          return (
            <div
              key={s}
              style={{
                opacity: op,
                transform: `translateY(${y}px)`,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(163,196,224,0.25)",
                borderRadius: 16,
                padding: "22px 28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.white }}>{s}</div>
              <div style={{ fontSize: 20, color: COLORS.success, fontWeight: 600 }}>✓ supported</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ============ SCENE 5: CTA ============
const SClose = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const iconSc = spring({ frame, fps, config: { damping: 8, stiffness: 100 } });
  const t1Op = interpolate(frame, [15, 32], [0, 1], { extrapolateRight: "clamp" });
  const t1Y = interpolate(spring({ frame: frame - 15, fps, config: { damping: 18 } }), [0, 1], [30, 0]);
  const t2Op = interpolate(frame, [32, 50], [0, 1], { extrapolateRight: "clamp" });
  const ctaSc = spring({ frame: frame - 50, fps, config: { damping: 10, stiffness: 90 } });
  const ctaOp = interpolate(frame, [50, 70], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, opacity: fadeIn, justifyContent: "center", alignItems: "center", padding: "0 60px", textAlign: "center" }}>
      <Img src={staticFile("images/extension-icon.png")} style={{ width: 180, height: 180, transform: `scale(${iconSc})`, objectFit: "contain" }} />
      <div style={{ marginTop: 28, opacity: t1Op, transform: `translateY(${t1Y}px)`, fontSize: 60, fontWeight: 700, color: COLORS.white, lineHeight: 1.05, letterSpacing: -2 }}>
        HomeLens for{"\n"}Chrome.
      </div>
      <div style={{ marginTop: 18, opacity: t2Op, fontSize: 26, fontWeight: 500, color: COLORS.accent, letterSpacing: 1 }}>
        homelensais.com
      </div>
      <div
        style={{
          marginTop: 56,
          opacity: ctaOp,
          transform: `scale(${ctaSc})`,
          padding: "22px 46px",
          borderRadius: 999,
          background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryLight})`,
          color: COLORS.white,
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: 1,
          boxShadow: "0 25px 60px rgba(107,141,181,0.5)",
        }}
      >
        Add to Chrome — Free
      </div>
    </AbsoluteFill>
  );
};

// ============ COMPOSITION ============
// hook 80 | browse 150 | click 160 | works 115 | close 105 = 610 -> pad to 620
export const EXTENSION_VERTICAL_DURATION = 610;

export const ExtensionVerticalVideo = () => (
  <AbsoluteFill>
    <VerticalBackground colors={COLORS} />
    <Sequence from={0} durationInFrames={80}><SHook /></Sequence>
    <Sequence from={80} durationInFrames={150}><SBrowse /></Sequence>
    <Sequence from={230} durationInFrames={160}><SClick /></Sequence>
    <Sequence from={390} durationInFrames={115}><SWorks /></Sequence>
    <Sequence from={505} durationInFrames={105}><SClose /></Sequence>
  </AbsoluteFill>
);
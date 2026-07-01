import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { VerticalBackground } from "./components/VerticalBackground";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });

export const COLORS = {
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
  success: "#7BC47F",
  gold: "#E8B84A",
};

type SceneProps = { colors: typeof COLORS };

// Reusable label chip
const Eyebrow = ({ children, opacity = 1 }: { children: React.ReactNode; opacity?: number }) => (
  <div style={{
    display: "inline-block", padding: "6px 14px", borderRadius: 999,
    background: "rgba(163,196,224,0.15)", border: "1px solid rgba(163,196,224,0.35)",
    color: COLORS.accent, fontSize: 16, fontWeight: 600, letterSpacing: 2,
    textTransform: "uppercase", opacity,
  }}>{children}</div>
);

const ScreenCard = ({ src, translateY, opacity, height = 900 }: { src: string; translateY: number; opacity: number; height?: number }) => (
  <div style={{
    position: "absolute", left: 40, right: 40, bottom: 80,
    opacity, transform: `translateY(${translateY}px)`,
    borderRadius: 24, overflow: "hidden",
    boxShadow: "0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(163,196,224,0.15)",
  }}>
    <Img src={staticFile(src)} style={{ width: "100%", height, objectFit: "cover", objectPosition: "top" }} />
  </div>
);

// ============ SCENE 1: HOOK ============
const SHook = ({ colors }: SceneProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeOut = interpolate(frame, [80, 99], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const l1Op = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const l1Y = interpolate(spring({ frame, fps, config: { damping: 18 } }), [0, 1], [40, 0]);
  const l2Op = interpolate(frame, [18, 35], [0, 1], { extrapolateRight: "clamp" });
  const l2Y = interpolate(spring({ frame: frame - 18, fps, config: { damping: 18 } }), [0, 1], [40, 0]);
  const l3Op = interpolate(frame, [38, 55], [0, 1], { extrapolateRight: "clamp" });
  const l3Scale = spring({ frame: frame - 38, fps, config: { damping: 10, stiffness: 90 } });

  return (
    <AbsoluteFill style={{ fontFamily, opacity: fadeOut, justifyContent: "center", alignItems: "center", padding: "0 60px", textAlign: "center" }}>
      <div style={{ opacity: l1Op, transform: `translateY(${l1Y}px)`, fontSize: 26, color: colors.muted, fontWeight: 500, marginBottom: 24 }}>
        Real estate investing
      </div>
      <div style={{ opacity: l2Op, transform: `translateY(${l2Y}px)`, fontSize: 72, fontWeight: 700, color: colors.white, lineHeight: 1.05, letterSpacing: -2 }}>
        without the{"\n"}spreadsheets.
      </div>
      <div style={{
        marginTop: 60, opacity: l3Op, transform: `scale(${l3Scale})`,
        padding: "18px 32px", borderRadius: 999,
        background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryLight})`,
        color: colors.white, fontSize: 22, fontWeight: 700, letterSpacing: 1,
        boxShadow: "0 20px 50px rgba(107,141,181,0.4)",
      }}>
        4 tools every investor needs
      </div>
    </AbsoluteFill>
  );
};

// ============ SCENE 2: INVESTOR BRIEF ============
const SBrief = ({ colors }: SceneProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [130, 149], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const ebOp = interpolate(frame, [8, 24], [0, 1], { extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [14, 30], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(spring({ frame: frame - 14, fps, config: { damping: 18 } }), [0, 1], [30, 0]);

  const screenOp = interpolate(frame, [28, 48], [0, 1], { extrapolateRight: "clamp" });
  const screenY = interpolate(spring({ frame: frame - 28, fps, config: { damping: 16, stiffness: 90 } }), [0, 1], [120, 0]);

  const stats = ["Labor Health", "Wage Growth", "Permits", "Rate Trend"];

  return (
    <AbsoluteFill style={{ fontFamily, opacity: fadeIn * fadeOut }}>
      <div style={{ position: "absolute", top: 140, left: 60, right: 60, textAlign: "center" }}>
        <div style={{ opacity: ebOp }}><Eyebrow>01 · Investor Brief</Eyebrow></div>
        <div style={{ marginTop: 24, opacity: titleOp, transform: `translateY(${titleY}px)`, fontSize: 52, fontWeight: 700, color: colors.white, lineHeight: 1.1, letterSpacing: -1 }}>
          Know a market{"\n"}before you enter it.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 28, justifyContent: "center" }}>
          {stats.map((s, i) => {
            const op = interpolate(frame, [30 + i * 5, 45 + i * 5], [0, 1], { extrapolateRight: "clamp" });
            const sc = spring({ frame: frame - 30 - i * 5, fps, config: { damping: 12 } });
            return (
              <div key={i} style={{
                opacity: op, transform: `scale(${sc})`,
                padding: "8px 16px", borderRadius: 999,
                background: "rgba(107,141,181,0.22)", border: "1px solid rgba(163,196,224,0.3)",
                color: colors.accent, fontSize: 16, fontWeight: 600,
              }}>{s}</div>
            );
          })}
        </div>
      </div>
      <ScreenCard src="images/investor-brief.png" translateY={screenY} opacity={screenOp} height={900} />
    </AbsoluteFill>
  );
};

// ============ SCENE 3: INVESTOR CALCULATOR ============
const SCalc = ({ colors }: SceneProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [130, 149], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const ebOp = interpolate(frame, [8, 24], [0, 1], { extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [14, 30], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(spring({ frame: frame - 14, fps, config: { damping: 18 } }), [0, 1], [30, 0]);

  const screenOp = interpolate(frame, [28, 48], [0, 1], { extrapolateRight: "clamp" });
  const screenY = interpolate(spring({ frame: frame - 28, fps, config: { damping: 16, stiffness: 90 } }), [0, 1], [120, 0]);

  const metrics = ["Cap Rate", "Cash-on-Cash", "DSCR", "IRR", "Tax-aware exits"];

  return (
    <AbsoluteFill style={{ fontFamily, opacity: fadeIn * fadeOut }}>
      <div style={{ position: "absolute", top: 140, left: 60, right: 60, textAlign: "center" }}>
        <div style={{ opacity: ebOp }}><Eyebrow>02 · Deal Calculator</Eyebrow></div>
        <div style={{ marginTop: 24, opacity: titleOp, transform: `translateY(${titleY}px)`, fontSize: 52, fontWeight: 700, color: colors.white, lineHeight: 1.1, letterSpacing: -1 }}>
          Underwrite any deal{"\n"}in seconds.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 28, justifyContent: "center" }}>
          {metrics.map((m, i) => {
            const op = interpolate(frame, [30 + i * 5, 45 + i * 5], [0, 1], { extrapolateRight: "clamp" });
            const sc = spring({ frame: frame - 30 - i * 5, fps, config: { damping: 12 } });
            return (
              <div key={i} style={{
                opacity: op, transform: `scale(${sc})`,
                padding: "8px 16px", borderRadius: 999,
                background: "rgba(123,196,127,0.15)", border: "1px solid rgba(123,196,127,0.35)",
                color: colors.success, fontSize: 16, fontWeight: 600,
              }}>{m}</div>
            );
          })}
        </div>
      </div>
      <ScreenCard src="images/investor-calculator.png" translateY={screenY} opacity={screenOp} height={900} />
    </AbsoluteFill>
  );
};

// ============ SCENE 4: MY PROPERTIES ============
const SPortfolio = ({ colors }: SceneProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [130, 149], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const ebOp = interpolate(frame, [8, 24], [0, 1], { extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [14, 30], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(spring({ frame: frame - 14, fps, config: { damping: 18 } }), [0, 1], [30, 0]);

  const screenOp = interpolate(frame, [28, 48], [0, 1], { extrapolateRight: "clamp" });
  const screenY = interpolate(spring({ frame: frame - 28, fps, config: { damping: 16, stiffness: 90 } }), [0, 1], [120, 0]);

  const kpis = [
    { label: "Live Valuations", accent: colors.accent },
    { label: "Cash Flow", accent: colors.success },
    { label: "Schedule E Ready", accent: colors.gold },
  ];

  return (
    <AbsoluteFill style={{ fontFamily, opacity: fadeIn * fadeOut }}>
      <div style={{ position: "absolute", top: 140, left: 60, right: 60, textAlign: "center" }}>
        <div style={{ opacity: ebOp }}><Eyebrow>03 · Portfolio Tracker</Eyebrow></div>
        <div style={{ marginTop: 24, opacity: titleOp, transform: `translateY(${titleY}px)`, fontSize: 52, fontWeight: 700, color: colors.white, lineHeight: 1.1, letterSpacing: -1 }}>
          Your properties.{"\n"}Always current.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 28, justifyContent: "center" }}>
          {kpis.map((k, i) => {
            const op = interpolate(frame, [30 + i * 6, 45 + i * 6], [0, 1], { extrapolateRight: "clamp" });
            const sc = spring({ frame: frame - 30 - i * 6, fps, config: { damping: 12 } });
            return (
              <div key={i} style={{
                opacity: op, transform: `scale(${sc})`,
                padding: "8px 16px", borderRadius: 999,
                background: "rgba(107,141,181,0.18)", border: `1px solid ${k.accent}66`,
                color: k.accent, fontSize: 16, fontWeight: 600,
              }}>{k.label}</div>
            );
          })}
        </div>
      </div>
      <ScreenCard src="images/my-properties.png" translateY={screenY} opacity={screenOp} height={480} />
    </AbsoluteFill>
  );
};

// ============ SCENE 5: CHROME EXTENSION ON LISTINGS ============
const SExtension = ({ colors }: SceneProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [110, 129], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const ebOp = interpolate(frame, [8, 24], [0, 1], { extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [14, 30], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(spring({ frame: frame - 14, fps, config: { damping: 18 } }), [0, 1], [30, 0]);

  const screenOp = interpolate(frame, [28, 48], [0, 1], { extrapolateRight: "clamp" });
  const screenY = interpolate(spring({ frame: frame - 28, fps, config: { damping: 16, stiffness: 90 } }), [0, 1], [120, 0]);

  // Score badge popping in
  const badgeSc = spring({ frame: frame - 55, fps, config: { damping: 10, stiffness: 120 } });
  const badgeOp = interpolate(frame, [55, 70], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, opacity: fadeIn * fadeOut }}>
      <div style={{ position: "absolute", top: 140, left: 60, right: 60, textAlign: "center" }}>
        <div style={{ opacity: ebOp }}><Eyebrow>04 · Chrome Extension</Eyebrow></div>
        <div style={{ marginTop: 24, opacity: titleOp, transform: `translateY(${titleY}px)`, fontSize: 52, fontWeight: 700, color: colors.white, lineHeight: 1.1, letterSpacing: -1 }}>
          Analyze listings{"\n"}right on Zillow.
        </div>
      </div>
      <ScreenCard src="images/page-extension.png" translateY={screenY} opacity={screenOp} height={900} />
      <div style={{
        position: "absolute", right: 70, bottom: 720,
        opacity: badgeOp, transform: `scale(${badgeSc})`,
        padding: "14px 22px", borderRadius: 20,
        background: `linear-gradient(135deg, ${colors.success}, #5FA363)`,
        color: colors.white, fontSize: 22, fontWeight: 700,
        boxShadow: "0 15px 40px rgba(123,196,127,0.5)",
      }}>
        Match 9.2/10
      </div>
    </AbsoluteFill>
  );
};

// ============ SCENE 6: CLOSING ============
const SClose = ({ colors }: SceneProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  const logoSc = spring({ frame: frame - 4, fps, config: { damping: 12, stiffness: 80 } });
  const logoOp = interpolate(frame, [4, 20], [0, 1], { extrapolateRight: "clamp" });
  const t1Op = interpolate(frame, [20, 38], [0, 1], { extrapolateRight: "clamp" });
  const t1Y = interpolate(spring({ frame: frame - 20, fps, config: { damping: 18 } }), [0, 1], [30, 0]);
  const t2Op = interpolate(frame, [40, 58], [0, 1], { extrapolateRight: "clamp" });

  const ctaSc = spring({ frame: frame - 55, fps, config: { damping: 10, stiffness: 90 } });
  const ctaOp = interpolate(frame, [55, 75], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, opacity: fadeIn, justifyContent: "center", alignItems: "center", padding: "0 60px", textAlign: "center" }}>
      <Img src={staticFile("images/logo.png")} style={{
        width: 160, height: 160, opacity: logoOp, transform: `scale(${logoSc})`, objectFit: "contain",
      }} />
      <div style={{
        marginTop: 32, opacity: t1Op, transform: `translateY(${t1Y}px)`,
        fontSize: 46, fontWeight: 700, color: colors.white, lineHeight: 1.15, letterSpacing: -1,
      }}>
        Every investor tool,{"\n"}in one place.
      </div>
      <div style={{ marginTop: 20, opacity: t2Op, fontSize: 24, fontWeight: 600, color: colors.accent, letterSpacing: 1 }}>
        homelensais.com
      </div>
      <div style={{
        marginTop: 56, opacity: ctaOp, transform: `scale(${ctaSc})`,
        padding: "22px 44px", borderRadius: 999,
        background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryLight})`,
        color: colors.white, fontSize: 26, fontWeight: 700, letterSpacing: 1,
        boxShadow: "0 25px 60px rgba(107,141,181,0.5)",
      }}>
        Try HomeLens Free
      </div>
    </AbsoluteFill>
  );
};

// ============ COMPOSITION ============
// Scenes: hook 100 | brief 150 | calc 150 | portfolio 150 | extension 130 | close 120 = 800 frames = ~26.7s
export const INVESTOR_VERTICAL_DURATION = 800;

export const InvestorVerticalVideo = () => (
  <AbsoluteFill>
    <VerticalBackground colors={COLORS} />
    <Sequence from={0} durationInFrames={100}><SHook colors={COLORS} /></Sequence>
    <Sequence from={100} durationInFrames={150}><SBrief colors={COLORS} /></Sequence>
    <Sequence from={250} durationInFrames={150}><SCalc colors={COLORS} /></Sequence>
    <Sequence from={400} durationInFrames={150}><SPortfolio colors={COLORS} /></Sequence>
    <Sequence from={550} durationInFrames={130}><SExtension colors={COLORS} /></Sequence>
    <Sequence from={680} durationInFrames={120}><SClose colors={COLORS} /></Sequence>
  </AbsoluteFill>
);
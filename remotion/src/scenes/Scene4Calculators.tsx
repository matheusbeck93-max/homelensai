import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400", "600"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const Scene4Calculators = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  // Left side: Buying Power + Mortgage
  const leftCardOp = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });
  const leftCardScale = spring({ frame: frame - 10, fps, config: { damping: 14 } });

  // Right side: Investor Calculator
  const rightCardOp = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" });
  const rightCardScale = spring({ frame: frame - 25, fps, config: { damping: 14 } });

  const investorFeatures = [
    { label: "Simple / Advanced Modes", delay: 40 },
    { label: "Auto PMI Removal at 20% Equity", delay: 50 },
    { label: "ARM Re-amortization", delay: 60 },
    { label: "State vs Federal Capital Gains", delay: 70 },
    { label: "Stress Test Scenarios", delay: 80 },
    { label: "Multi-tab Excel Export", delay: 90 },
  ];

  return (
    <AbsoluteFill style={{ fontFamily, padding: 80 }}>
      {/* Title */}
      <div
        style={{
          opacity: titleOpacity,
          textAlign: "center",
          fontSize: 50,
          fontWeight: 700,
          color: colors.white,
          marginBottom: 50,
        }}
      >
        Financial{" "}
        <span style={{ color: colors.accent }}>Intelligence</span>
      </div>

      <div style={{ display: "flex", gap: 30, height: 700 }}>
        {/* Left: Buying Power + Mortgage */}
        <div
          style={{
            flex: 1,
            opacity: leftCardOp,
            transform: `scale(${leftCardScale})`,
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          {[
            { title: "Buying Power Calculator", icon: "💰", metrics: [
              { k: "Max Purchase", v: "$425,000" },
              { k: "Monthly Budget", v: "$2,800" },
            ]},
            { title: "Mortgage Calculator", icon: "🏦", metrics: [
              { k: "Monthly Payment", v: "$2,145" },
              { k: "Total Interest", v: "$172,200" },
            ]},
          ].map((calc, ci) => (
            <div
              key={ci}
              style={{
                flex: 1,
                background: `rgba(58, 80, 104, 0.6)`,
                borderRadius: 20,
                border: `1px solid rgba(107, 141, 181, 0.2)`,
                padding: 28,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <span style={{ fontSize: 28 }}>{calc.icon}</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: colors.white }}>{calc.title}</span>
              </div>
              {calc.metrics.map((m, mi) => {
                const mDelay = 30 + ci * 15 + mi * 10;
                const mOp = interpolate(frame, [mDelay, mDelay + 12], [0, 1], { extrapolateRight: "clamp" });
                return (
                  <div key={mi} style={{ opacity: mOp, display: "flex", justifyContent: "space-between", marginTop: 12 }}>
                    <span style={{ fontSize: 17, color: colors.muted }}>{m.k}</span>
                    <span style={{ fontSize: 22, fontWeight: 700, color: colors.accent }}>{m.v}</span>
                  </div>
                );
              })}
              <div style={{
                opacity: interpolate(frame, [50 + ci * 15, 60 + ci * 15], [0, 1], { extrapolateRight: "clamp" }),
                marginTop: 16,
                padding: "8px 14px",
                borderRadius: 8,
                background: `rgba(107, 141, 181, 0.15)`,
                fontSize: 14,
                color: colors.accent,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}>
                <span>🤖</span> AI Insights Included
              </div>
            </div>
          ))}
        </div>

        {/* Right: Investor Calculator */}
        <div
          style={{
            flex: 1,
            opacity: rightCardOp,
            transform: `scale(${rightCardScale})`,
            background: `rgba(58, 80, 104, 0.6)`,
            borderRadius: 20,
            border: `1px solid rgba(163, 196, 224, 0.3)`,
            padding: 32,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 28 }}>📊</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: colors.white }}>Investor Calculator</span>
          </div>
          <div style={{ fontSize: 15, color: colors.muted, marginBottom: 28, lineHeight: 1.5 }}>
            Professional-grade analysis for serious investors
          </div>

          {investorFeatures.map((f, i) => {
            const op = interpolate(frame, [f.delay, f.delay + 12], [0, 1], { extrapolateRight: "clamp" });
            const x = interpolate(
              spring({ frame: frame - f.delay, fps, config: { damping: 18 } }),
              [0, 1], [40, 0]
            );
            return (
              <div
                key={i}
                style={{
                  opacity: op,
                  transform: `translateX(${x}px)`,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: i < investorFeatures.length - 1 ? `1px solid rgba(107, 141, 181, 0.12)` : "none",
                }}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: 4,
                  background: colors.accent,
                }} />
                <span style={{ fontSize: 17, color: colors.white, fontWeight: 500 }}>{f.label}</span>
              </div>
            );
          })}

          {/* Bottom metrics */}
          <div style={{ marginTop: "auto", display: "flex", gap: 20 }}>
            {[
              { label: "Avg ROI", val: "8.2%" },
              { label: "Cap Rate", val: "5.4%" },
              { label: "Cash Flow", val: "$850/mo" },
            ].map((s, i) => {
              const op = interpolate(frame, [95 + i * 8, 105 + i * 8], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div key={i} style={{ opacity: op, flex: 1, textAlign: "center", padding: "14px 0", borderRadius: 10, background: `rgba(107, 141, 181, 0.12)` }}>
                  <div style={{ fontSize: 13, color: colors.muted }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: colors.accent, marginTop: 4 }}>{s.val}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

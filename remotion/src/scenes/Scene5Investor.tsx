import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400", "600"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const Scene5Investor = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  const tagOp = interpolate(frame, [10, 28], [0, 1], { extrapolateRight: "clamp" });

  const features = [
    { label: "Simple & Advanced Modes", icon: "⚡", delay: 15 },
    { label: "Auto PMI Removal at 20% Equity", icon: "🔄", delay: 23 },
    { label: "ARM Re-amortization", icon: "📐", delay: 31 },
    { label: "State vs Federal Capital Gains", icon: "🏛️", delay: 39 },
    { label: "Stress Test Scenarios", icon: "🎯", delay: 47 },
    { label: "Multi-tab Excel Export", icon: "📊", delay: 55 },
  ];

  const metricsDelay = 65;
  const bottomMetrics = [
    { label: "Cash Flow", val: "$850/mo" },
    { label: "Cap Rate", val: "5.4%" },
    { label: "CoC Return", val: "12.1%" },
    { label: "Total ROI", val: "8.2%" },
  ];

  const cardOp = interpolate(frame, [8, 22], [0, 1], { extrapolateRight: "clamp" });
  const cardScale = spring({ frame: frame - 8, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ fontFamily, padding: 80 }}>
      <div style={{ display: "flex", height: "100%", gap: 50 }}>
        {/* Left text */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{
            opacity: titleOp, fontSize: 48, fontWeight: 700, color: colors.white, lineHeight: 1.15,
          }}>
            Run <span style={{ color: colors.accent }}>Real Numbers</span>
          </div>
          <div style={{
            opacity: tagOp, fontSize: 19, color: colors.muted, marginTop: 20, lineHeight: 1.7, maxWidth: 440,
          }}>
            Cash flow, returns, risk — all in one place. Professional-grade analysis for serious investors.
          </div>

          {/* Bottom metrics */}
          <div style={{
            opacity: interpolate(frame, [metricsDelay, metricsDelay + 15], [0, 1], { extrapolateRight: "clamp" }),
            marginTop: 40, display: "flex", gap: 16, flexWrap: "wrap",
          }}>
            {bottomMetrics.map((m, i) => {
              const op = interpolate(frame, [metricsDelay + i * 6, metricsDelay + i * 6 + 10], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div key={i} style={{
                  opacity: op, padding: "14px 20px", borderRadius: 14,
                  background: `rgba(58, 80, 104, 0.7)`, border: `1px solid rgba(107,141,181,0.2)`,
                  textAlign: "center", minWidth: 120,
                }}>
                  <div style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: colors.accent }}>{m.val}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right feature list */}
        <div style={{
          flex: 1, opacity: cardOp, transform: `scale(${cardScale})`,
          background: `rgba(58, 80, 104, 0.65)`, borderRadius: 24,
          border: `1px solid rgba(163, 196, 224, 0.3)`, padding: 36,
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 28 }}>📈</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: colors.white }}>Investor Calculator</span>
          </div>
          <div style={{ fontSize: 14, color: colors.muted, marginBottom: 28 }}>
            Professional-grade investment analysis
          </div>

          {features.map((f, i) => {
            const op = interpolate(frame, [f.delay, f.delay + 10], [0, 1], { extrapolateRight: "clamp" });
            const x = interpolate(
              spring({ frame: frame - f.delay, fps, config: { damping: 18 } }),
              [0, 1], [30, 0]
            );
            return (
              <div key={i} style={{
                opacity: op, transform: `translateX(${x}px)`,
                display: "flex", alignItems: "center", gap: 14, padding: "13px 0",
                borderBottom: i < features.length - 1 ? `1px solid rgba(107,141,181,0.1)` : "none",
              }}>
                <span style={{ fontSize: 18 }}>{f.icon}</span>
                <span style={{ fontSize: 16, color: colors.white, fontWeight: 500 }}>{f.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

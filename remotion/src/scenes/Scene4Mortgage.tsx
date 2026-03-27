import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400", "600"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const Scene4Mortgage = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  const cardOp = interpolate(frame, [10, 25], [0, 1], { extrapolateRight: "clamp" });
  const cardScale = spring({ frame: frame - 10, fps, config: { damping: 14 } });

  const pitiItems = [
    { label: "Principal & Interest", value: "$1,845", color: colors.accent, pct: 65, delay: 20 },
    { label: "Property Tax", value: "$385", color: colors.primaryLight, pct: 14, delay: 28 },
    { label: "Insurance", value: "$125", color: colors.muted, pct: 4, delay: 36 },
    { label: "PMI", value: "$95", color: colors.mutedDark, pct: 3, delay: 44 },
  ];

  const totalOp = interpolate(frame, [55, 68], [0, 1], { extrapolateRight: "clamp" });
  const totalScale = spring({ frame: frame - 55, fps, config: { damping: 12 } });

  const summaryItems = [
    { k: "Loan Amount", v: "$380,000", delay: 60 },
    { k: "Interest Rate", v: "6.75%", delay: 66 },
    { k: "Loan Term", v: "30 years", delay: 72 },
    { k: "Total Interest", v: "$172,200", delay: 78 },
  ];

  return (
    <AbsoluteFill style={{ fontFamily, padding: 80 }}>
      <div style={{
        opacity: titleOp, textAlign: "center", fontSize: 48, fontWeight: 700,
        color: colors.white, marginBottom: 44,
      }}>
        Model Your <span style={{ color: colors.accent }}>Monthly Costs</span>
      </div>

      <div style={{ display: "flex", gap: 32, flex: 1 }}>
        {/* Left: PITI Breakdown */}
        <div style={{
          flex: 1, opacity: cardOp, transform: `scale(${cardScale})`,
          background: `rgba(58, 80, 104, 0.65)`, borderRadius: 24,
          border: `1px solid rgba(163, 196, 224, 0.25)`, padding: 32,
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <span style={{ fontSize: 26 }}>🏦</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: colors.white }}>PITI Breakdown</span>
          </div>

          {pitiItems.map((item, i) => {
            const op = interpolate(frame, [item.delay, item.delay + 12], [0, 1], { extrapolateRight: "clamp" });
            const barW = interpolate(
              spring({ frame: frame - item.delay, fps, config: { damping: 20 } }),
              [0, 1], [0, item.pct]
            );
            return (
              <div key={i} style={{ opacity: op, marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 15, color: colors.muted }}>{item.label}</span>
                  <span style={{ fontSize: 17, fontWeight: 600, color: colors.white }}>{item.value}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "rgba(107,141,181,0.12)" }}>
                  <div style={{
                    height: 8, borderRadius: 4, width: `${barW}%`, background: item.color,
                  }} />
                </div>
              </div>
            );
          })}

          <div style={{
            opacity: totalOp, transform: `scale(${totalScale})`,
            marginTop: "auto", padding: "18px 0", textAlign: "center",
            borderTop: `1px solid rgba(107,141,181,0.2)`,
          }}>
            <div style={{ fontSize: 14, color: colors.muted }}>Total Monthly Payment</div>
            <div style={{ fontSize: 38, fontWeight: 700, color: colors.accent, marginTop: 4 }}>$2,450</div>
          </div>
        </div>

        {/* Right: Loan summary */}
        <div style={{
          flex: 1, opacity: cardOp, transform: `scale(${cardScale})`,
          background: `rgba(58, 80, 104, 0.65)`, borderRadius: 24,
          border: `1px solid rgba(163, 196, 224, 0.25)`, padding: 32,
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <span style={{ fontSize: 26 }}>📊</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: colors.white }}>Loan Summary</span>
          </div>

          {summaryItems.map((s, i) => {
            const op = interpolate(frame, [s.delay, s.delay + 10], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div key={i} style={{
                opacity: op, display: "flex", justifyContent: "space-between",
                padding: "16px 0",
                borderBottom: i < summaryItems.length - 1 ? `1px solid rgba(107,141,181,0.1)` : "none",
              }}>
                <span style={{ fontSize: 17, color: colors.muted }}>{s.k}</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: colors.white }}>{s.v}</span>
              </div>
            );
          })}

          <div style={{
            opacity: interpolate(frame, [85, 98], [0, 1], { extrapolateRight: "clamp" }),
            marginTop: "auto", padding: "12px 18px", borderRadius: 12,
            background: `rgba(107, 141, 181, 0.15)`,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span>🤖</span>
            <span style={{ fontSize: 14, color: colors.accent }}>AI Insights: Your rate is competitive for this market</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

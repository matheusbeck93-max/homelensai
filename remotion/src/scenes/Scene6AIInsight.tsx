import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400", "500"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const Scene6AIInsight = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  const insights = [
    { icon: "🏠", title: "Property Analysis", desc: "Deep AI evaluation of every listing", delay: 12 },
    { icon: "🗺️", title: "Neighborhood Insights", desc: "Safety, schools, walkability scores", delay: 22 },
    { icon: "🎭", title: "Neighborhood Personality", desc: "Lifestyle match for your preferences", delay: 32 },
    { icon: "📄", title: "PDF Export", desc: "Share professional reports instantly", delay: 42 },
    { icon: "⚖️", title: "Side-by-Side Comparison", desc: "Compare properties via floating bar", delay: 52 },
    { icon: "🔗", title: "External Links", desc: "Zillow, Redfin, and more in one click", delay: 62 },
  ];

  const tagOp = interpolate(frame, [75, 90], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, padding: 80 }}>
      <div style={{
        opacity: titleOp, textAlign: "center", fontSize: 48, fontWeight: 700,
        color: colors.white, marginBottom: 16,
      }}>
        Let AI Put It <span style={{ color: colors.accent }}>All Together</span>
      </div>

      <div style={{
        opacity: interpolate(frame, [8, 22], [0, 1], { extrapolateRight: "clamp" }),
        textAlign: "center", fontSize: 19, color: colors.muted, marginBottom: 44,
      }}>
        Every tool works together to give you the full picture
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "center" }}>
        {insights.map((item, i) => {
          const op = interpolate(frame, [item.delay, item.delay + 12], [0, 1], { extrapolateRight: "clamp" });
          const y = interpolate(
            spring({ frame: frame - item.delay, fps, config: { damping: 14 } }),
            [0, 1], [40, 0]
          );
          return (
            <div key={i} style={{
              opacity: op, transform: `translateY(${y}px)`,
              width: 540, padding: "22px 28px", borderRadius: 18,
              background: `rgba(58, 80, 104, 0.6)`,
              border: `1px solid rgba(107, 141, 181, 0.2)`,
              display: "flex", alignItems: "center", gap: 18,
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: `rgba(107, 141, 181, 0.2)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24, flexShrink: 0,
              }}>
                {item.icon}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: colors.white }}>{item.title}</div>
                <div style={{ fontSize: 14, color: colors.muted, marginTop: 2 }}>{item.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        opacity: tagOp, textAlign: "center", marginTop: 36,
        fontSize: 16, color: colors.accent, fontWeight: 500,
      }}>
        All powered by advanced AI analysis
      </div>
    </AbsoluteFill>
  );
};

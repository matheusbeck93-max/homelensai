import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "500"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

const features = [
  { icon: "🏠", title: "Smart Search", desc: "AI understands what you need" },
  { icon: "📊", title: "Market Analysis", desc: "Real-time market snapshots" },
  { icon: "🧮", title: "Calculators", desc: "Mortgage, ROI & buying power" },
  { icon: "💼", title: "Portfolio", desc: "Track your investments" },
  { icon: "🔔", title: "Alerts", desc: "Price drops & status changes" },
  { icon: "📋", title: "Property Compare", desc: "Side-by-side analysis" },
];

export const Scene3Features = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          opacity: titleOpacity,
          fontSize: 52,
          fontWeight: 700,
          color: colors.white,
          marginBottom: 60,
          textAlign: "center",
        }}
      >
        Everything You Need,{" "}
        <span style={{ color: colors.accent }}>One Platform</span>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 28,
          maxWidth: 1200,
        }}
      >
        {features.map((f, i) => {
          const delay = 15 + i * 10;
          const cardScale = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 120 } });
          const cardOpacity = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: "clamp" });

          return (
            <div
              key={i}
              style={{
                opacity: cardOpacity,
                transform: `scale(${cardScale})`,
                width: 340,
                padding: "32px 28px",
                background: `rgba(58, 80, 104, 0.7)`,
                borderRadius: 20,
                border: `1px solid rgba(107, 141, 181, 0.25)`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 40 }}>{f.icon}</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: colors.white }}>{f.title}</span>
              <span style={{ fontSize: 16, color: colors.muted, textAlign: "center" }}>{f.desc}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

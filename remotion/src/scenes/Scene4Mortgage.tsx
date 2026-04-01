import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400", "500"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const Scene4Mortgage = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [130, 149], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = fadeIn * fadeOut;

  const screenScale = interpolate(spring({ frame: frame - 5, fps, config: { damping: 14, stiffness: 80 } }), [0, 1], [0.9, 1]);
  const screenOp = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" });

  const bars = [
    { label: "Principal & Interest", w: 65, delay: 50 },
    { label: "Property Taxes", w: 20, delay: 60 },
    { label: "Insurance", w: 10, delay: 70 },
    { label: "HOA", w: 5, delay: 80 },
  ];

  return (
    <AbsoluteFill style={{ fontFamily, opacity: op }}>
      <div style={{
        position: "absolute", left: "50%", top: 50,
        transform: `translateX(-50%) scale(${screenScale})`,
        opacity: screenOp, borderRadius: 16, overflow: "hidden",
        boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
        border: "1px solid rgba(107,141,181,0.2)",
      }}>
        <Img src={staticFile("images/page-calculators.png")} style={{ width: 1300, height: 580, objectFit: "cover", objectPosition: "center 70%" }} />
      </div>

      <div style={{ position: "absolute", bottom: 80, left: 80, right: 80, opacity: interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" }) }}>
        <div style={{ fontSize: 22, color: colors.accent, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
          Mortgage Calculator + PITI
        </div>
        <div style={{ fontSize: 36, fontWeight: 700, color: colors.white, lineHeight: 1.3, marginBottom: 28 }}>
          Model your mortgage, taxes, and monthly costs before you commit.
        </div>
        <div style={{ display: "flex", gap: 12, height: 36 }}>
          {bars.map((bar, i) => {
            const barW = interpolate(spring({ frame: frame - bar.delay, fps, config: { damping: 20 } }), [0, 1], [0, bar.w]);
            return (
              <div key={i} style={{
                width: `${barW}%`, height: "100%", borderRadius: 8,
                background: i === 0 ? colors.primary : i === 1 ? colors.primaryLight : i === 2 ? colors.accent : colors.muted,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: barW > 15 ? 13 : 0, color: colors.dark, fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap",
              }}>{bar.label}</div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400", "500"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const VScene4Mortgage = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [130, 149], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = fadeIn * fadeOut;

  const screenScale = interpolate(spring({ frame: frame - 5, fps, config: { damping: 14, stiffness: 80 } }), [0, 1], [0.9, 1]);
  const screenOp = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" });

  const bars = [
    { label: "P&I", w: 65, delay: 50 },
    { label: "Taxes", w: 20, delay: 60 },
    { label: "Ins.", w: 10, delay: 70 },
    { label: "HOA", w: 5, delay: 80 },
  ];

  return (
    <AbsoluteFill style={{ fontFamily, opacity: op }}>
      {/* Screenshot on top */}
      <div style={{
        position: "absolute", left: 30, right: 30, top: 100,
        transform: `scale(${screenScale})`,
        opacity: screenOp, borderRadius: 16, overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        border: "1px solid rgba(107,141,181,0.2)",
      }}>
        <Img src={staticFile("images/page-calculators.png")} style={{ width: "100%", height: 900, objectFit: "cover", objectPosition: "center 70%" }} />
      </div>

      {/* Text below */}
      <div style={{
        position: "absolute", bottom: 160, left: 50, right: 50,
        opacity: interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" }),
        textAlign: "center",
      }}>
        <div style={{ fontSize: 18, color: colors.accent, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
          Mortgage + PITI
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, color: colors.white, lineHeight: 1.3, marginBottom: 24 }}>
          Model your mortgage, taxes, and monthly costs before you commit.
        </div>
        <div style={{ display: "flex", gap: 8, height: 32, justifyContent: "center" }}>
          {bars.map((bar, i) => {
            const barW = interpolate(spring({ frame: frame - bar.delay, fps, config: { damping: 20 } }), [0, 1], [0, bar.w * 8]);
            return (
              <div key={i} style={{
                width: barW, height: "100%", borderRadius: 8,
                background: i === 0 ? colors.primary : i === 1 ? colors.primaryLight : i === 2 ? colors.accent : colors.muted,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: barW > 80 ? 11 : 0, color: colors.dark, fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap",
              }}>{bar.label}</div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

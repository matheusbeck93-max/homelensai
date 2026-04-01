import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400", "500"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const Scene5Investor = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [110, 129], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = fadeIn * fadeOut;

  const screenX = interpolate(spring({ frame: frame - 5, fps, config: { damping: 16, stiffness: 100 } }), [0, 1], [150, 0]);
  const screenOp = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" });

  const titleOp = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(spring({ frame: frame - 15, fps, config: { damping: 20 } }), [0, 1], [30, 0]);

  const badges = ["Cash Flow", "Cap Rate", "DSCR", "IRR", "Stress Test", "Excel Export"];

  return (
    <AbsoluteFill style={{ fontFamily, opacity: op }}>
      <div style={{ position: "absolute", left: 80, top: 180, opacity: titleOp, transform: `translateY(${titleY}px)` }}>
        <div style={{ fontSize: 22, color: colors.accent, fontWeight: 500, marginBottom: 16, letterSpacing: 2, textTransform: "uppercase" }}>Investor Calculator</div>
        <div style={{ fontSize: 44, fontWeight: 700, color: colors.white, lineHeight: 1.3, maxWidth: 480 }}>
          Run real numbers.{"\n"}Cash flow, returns,{"\n"}risk — all in one place.
        </div>
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 10, marginTop: 32, maxWidth: 420,
          opacity: interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" }),
        }}>
          {badges.map((badge, i) => {
            const badgeScale = spring({ frame: frame - 45 - i * 4, fps, config: { damping: 14 } });
            return (
              <div key={i} style={{
                padding: "8px 16px", borderRadius: 20,
                background: "rgba(107,141,181,0.2)", border: "1px solid rgba(107,141,181,0.3)",
                color: colors.accent, fontSize: 14, fontWeight: 500, transform: `scale(${badgeScale})`,
              }}>{badge}</div>
            );
          })}
        </div>
      </div>

      <div style={{
        position: "absolute", right: 40, top: 80, opacity: screenOp, transform: `translateX(${screenX}px)`,
        borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", border: "1px solid rgba(107,141,181,0.2)",
      }}>
        <Img src={staticFile("images/page-investor.png")} style={{ width: 1100, height: 720, objectFit: "cover", objectPosition: "top" }} />
      </div>
    </AbsoluteFill>
  );
};

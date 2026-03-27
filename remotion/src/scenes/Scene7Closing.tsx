import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const Scene7Closing = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 80 } });
  const logoOp = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  const nameOp = interpolate(frame, [15, 30], [0, 1], { extrapolateRight: "clamp" });

  const lineWidth = interpolate(
    spring({ frame: frame - 25, fps, config: { damping: 200 } }),
    [0, 1], [0, 500]
  );

  const tagOp = interpolate(frame, [30, 48], [0, 1], { extrapolateRight: "clamp" });
  const tagY = interpolate(
    spring({ frame: frame - 30, fps, config: { damping: 18 } }),
    [0, 1], [30, 0]
  );

  const sloganOp = interpolate(frame, [55, 72], [0, 1], { extrapolateRight: "clamp" });

  const glowOp = 0.1 + Math.sin(frame * 0.04) * 0.05;

  return (
    <AbsoluteFill style={{ fontFamily, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        position: "absolute", width: 600, height: 600, borderRadius: "50%",
        background: colors.primary, opacity: glowOp, filter: "blur(120px)",
      }} />

      <div style={{ opacity: logoOp, transform: `scale(${logoScale})`, marginBottom: 16 }}>
        <Img src={staticFile("images/logo.png")} style={{ width: 150, height: 150, objectFit: "contain" }} />
      </div>

      <div style={{
        opacity: nameOp, fontSize: 64, fontWeight: 700, color: colors.white, letterSpacing: -2,
      }}>
        Home<span style={{ color: colors.primaryLight }}>Lens</span>
      </div>

      <div style={{
        width: lineWidth, height: 2, margin: "16px 0",
        background: `linear-gradient(90deg, transparent, ${colors.accent}, transparent)`,
      }} />

      <div style={{
        opacity: tagOp, transform: `translateY(${tagY}px)`,
        fontSize: 26, color: colors.muted, textAlign: "center", lineHeight: 1.6,
      }}>
        Big decisions deserve the full picture.
      </div>

      <div style={{
        opacity: sloganOp, marginTop: 12,
        fontSize: 22, color: colors.accent, fontWeight: 500,
      }}>
        HomeLens does this for you.
      </div>
    </AbsoluteFill>
  );
};

import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const Scene1Intro = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 80 } });
  const logoOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  const textOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" });
  const textY = interpolate(
    spring({ frame: frame - 20, fps, config: { damping: 18 } }),
    [0, 1], [40, 0]
  );

  const lineWidth = interpolate(
    spring({ frame: frame - 35, fps, config: { damping: 200 } }),
    [0, 1], [0, 400]
  );

  const glowOpacity = 0.08 + Math.sin(frame * 0.04) * 0.04;

  return (
    <AbsoluteFill style={{ fontFamily, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        position: "absolute", width: 500, height: 500, borderRadius: "50%",
        background: colors.primary, opacity: glowOpacity, filter: "blur(100px)",
      }} />

      <div style={{ opacity: logoOpacity, transform: `scale(${logoScale})`, marginBottom: 16 }}>
        <Img src={staticFile("images/logo.png")} style={{ width: 160, height: 160, objectFit: "contain" }} />
      </div>

      <div style={{
        opacity: textOpacity, transform: `translateY(${textY}px)`,
        fontSize: 64, fontWeight: 700, color: colors.white, letterSpacing: -2,
      }}>
        Home<span style={{ color: colors.primaryLight }}>Lens</span>
      </div>

      <div style={{
        width: lineWidth, height: 2, margin: "14px 0",
        background: `linear-gradient(90deg, transparent, ${colors.accent}, transparent)`,
      }} />

      <div style={{
        opacity: interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" }),
        fontSize: 22, color: colors.muted, letterSpacing: 4, textTransform: "uppercase",
      }}>
        Smarter Real Estate Decisions
      </div>
    </AbsoluteFill>
  );
};

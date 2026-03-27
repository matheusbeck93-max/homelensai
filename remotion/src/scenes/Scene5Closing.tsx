import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const Scene5Closing = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });
  const titleOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });
  const subOpacity = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" });

  const lineWidth = interpolate(
    spring({ frame: frame - 55, fps, config: { damping: 200 } }),
    [0, 1], [0, 500]
  );

  const ctaOpacity = interpolate(frame, [70, 90], [0, 1], { extrapolateRight: "clamp" });
  const ctaScale = spring({ frame: frame - 70, fps, config: { damping: 14 } });

  const glowOpacity = 0.12 + Math.sin(frame * 0.05) * 0.06;

  return (
    <AbsoluteFill style={{ fontFamily, justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: colors.primary,
          opacity: glowOpacity,
          filter: "blur(120px)",
        }}
      />

      <div style={{ transform: `scale(${logoScale})`, marginBottom: 20 }}>
        <Img
          src={staticFile("images/logo.png")}
          style={{ width: 160, height: 160, objectFit: "contain" }}
        />
      </div>

      <div
        style={{
          opacity: titleOpacity,
          fontSize: 72,
          fontWeight: 700,
          color: colors.white,
          letterSpacing: -2,
        }}
      >
        Home<span style={{ color: colors.primaryLight }}>Lens</span>
      </div>

      <div
        style={{
          width: lineWidth,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${colors.accent}, transparent)`,
          margin: "20px 0",
        }}
      />

      <div
        style={{
          opacity: subOpacity,
          fontSize: 28,
          color: colors.muted,
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        Smarter Real Estate Decisions,
        <br />
        Powered by AI
      </div>

      <div
        style={{
          opacity: ctaOpacity,
          transform: `scale(${ctaScale})`,
          marginTop: 40,
          padding: "16px 48px",
          borderRadius: 50,
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryLight})`,
          fontSize: 22,
          fontWeight: 700,
          color: colors.white,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        Try HomeLens Today
      </div>
    </AbsoluteFill>
  );
};

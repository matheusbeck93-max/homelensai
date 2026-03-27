import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const Scene1Intro = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const logoOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  const titleY = interpolate(
    spring({ frame: frame - 20, fps, config: { damping: 18, stiffness: 150 } }),
    [0, 1], [60, 0]
  );
  const titleOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" });

  const subOpacity = interpolate(frame, [50, 70], [0, 1], { extrapolateRight: "clamp" });
  const subY = interpolate(
    spring({ frame: frame - 50, fps, config: { damping: 20 } }),
    [0, 1], [30, 0]
  );

  const tagOpacity = interpolate(frame, [75, 95], [0, 1], { extrapolateRight: "clamp" });

  const lineWidth = interpolate(
    spring({ frame: frame - 60, fps, config: { damping: 200 } }),
    [0, 1], [0, 400]
  );

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily }}>
      {/* Logo */}
      <div
        style={{
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
          marginBottom: 30,
        }}
      >
        <Img
          src={staticFile("images/logo.png")}
          style={{ width: 200, height: 200, objectFit: "contain" }}
        />
      </div>

      {/* Title */}
      <div
        style={{
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity,
          fontSize: 82,
          fontWeight: 700,
          color: colors.white,
          letterSpacing: -2,
        }}
      >
        Home<span style={{ color: colors.primaryLight }}>Lens</span>
      </div>

      {/* Gradient line */}
      <div
        style={{
          width: lineWidth,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${colors.primary}, ${colors.accent}, transparent)`,
          margin: "16px 0",
          borderRadius: 2,
        }}
      />

      {/* Subtitle */}
      <div
        style={{
          opacity: subOpacity,
          transform: `translateY(${subY}px)`,
          fontSize: 30,
          color: colors.muted,
          fontWeight: 400,
        }}
      >
        Your AI-Powered Real Estate Assistant
      </div>

      {/* Tagline */}
      <div
        style={{
          opacity: tagOpacity,
          fontSize: 20,
          color: colors.accent,
          marginTop: 20,
          fontWeight: 400,
          letterSpacing: 4,
          textTransform: "uppercase",
        }}
      >
        Search • Analyze • Invest
      </div>
    </AbsoluteFill>
  );
};

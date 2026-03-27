import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["700", "400"], subsets: ["latin"] });

interface Props {
  colors: Record<string, string>;
}

export const Scene1Intro = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Lens icon animation
  const lensScale = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const lensRotate = interpolate(spring({ frame: frame - 5, fps, config: { damping: 20 } }), [0, 1], [-90, 0]);

  // Title
  const titleY = interpolate(
    spring({ frame: frame - 15, fps, config: { damping: 18, stiffness: 150 } }),
    [0, 1], [60, 0]
  );
  const titleOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });

  // Subtitle
  const subOpacity = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" });
  const subY = interpolate(
    spring({ frame: frame - 40, fps, config: { damping: 20 } }),
    [0, 1], [30, 0]
  );

  // Tagline
  const tagOpacity = interpolate(frame, [65, 85], [0, 1], { extrapolateRight: "clamp" });

  // Subtle glow line
  const lineWidth = interpolate(
    spring({ frame: frame - 50, fps, config: { damping: 200 } }),
    [0, 1], [0, 400]
  );

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily }}>
      {/* Lens icon */}
      <div
        style={{
          transform: `scale(${lensScale}) rotate(${lensRotate}deg)`,
          marginBottom: 30,
        }}
      >
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
          <circle cx="50" cy="50" r="35" stroke={colors.primary} strokeWidth="6" fill="none" />
          <line x1="75" y1="75" x2="105" y2="105" stroke={colors.secondary} strokeWidth="6" strokeLinecap="round" />
          <circle cx="50" cy="50" r="15" fill={colors.primary} opacity="0.3" />
        </svg>
      </div>

      {/* Title */}
      <div
        style={{
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity,
          fontSize: 88,
          fontWeight: 700,
          color: colors.white,
          letterSpacing: -2,
        }}
      >
        Home<span style={{ color: colors.primary }}>Lens</span>
      </div>

      {/* Gradient line */}
      <div
        style={{
          width: lineWidth,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${colors.primary}, ${colors.secondary}, transparent)`,
          margin: "16px 0",
          borderRadius: 2,
        }}
      />

      {/* Subtitle */}
      <div
        style={{
          opacity: subOpacity,
          transform: `translateY(${subY}px)`,
          fontSize: 32,
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
          fontSize: 22,
          color: colors.secondary,
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

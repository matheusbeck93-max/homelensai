import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

export const SSlide1 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });
  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [170, 190], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = fadeIn * fadeOut;

  // Ken Burns
  const scale = interpolate(enter, [0, 1], [1.06, 1.0]) * interpolate(frame, [0, 190], [1.0, 1.04]);

  // slide-out to the left near end for transition
  const exitX = interpolate(frame, [170, 190], [0, -120], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // CTA pulse (bottom area)
  const pulse = 0.5 + 0.5 * Math.sin((frame - 100) * 0.15);
  const ctaGlow = interpolate(frame, [100, 160], [0, 0.6], { extrapolateRight: "clamp" }) * pulse;

  // floating accent orb behind mockup
  const orbY = Math.sin(frame * 0.04) * 20;
  const orbX = Math.cos(frame * 0.03) * 15;

  return (
    <AbsoluteFill style={{ opacity, justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          right: 40 + orbX,
          top: 380 + orbY,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)",
          filter: "blur(20px)",
        }}
      />
      <Img
        src={staticFile("images/slide-1.png")}
        style={{
          width: 1080,
          height: 1920,
          objectFit: "cover",
          transform: `translateX(${exitX}px) scale(${scale})`,
        }}
      />
      {/* CTA glow overlay */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 180,
          transform: `translateX(calc(-50% + ${exitX}px))`,
          width: 780,
          height: 120,
          borderRadius: 60,
          background: "radial-gradient(ellipse at center, rgba(37,99,235,0.55) 0%, transparent 70%)",
          opacity: ctaGlow,
          filter: "blur(15px)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
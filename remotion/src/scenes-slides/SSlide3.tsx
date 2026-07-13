import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

// Approximate rects for the 5 feature rows on slide 3 (image is 1080x1920)
const ROWS = [
  { left: 40, top: 690, width: 520, height: 130 },   // Affordability
  { left: 40, top: 850, width: 520, height: 130 },   // Market Insights
  { left: 40, top: 1010, width: 520, height: 130 },  // Payment Estimates
  { left: 40, top: 1170, width: 520, height: 130 },  // Investment Potential
  { left: 40, top: 1330, width: 520, height: 130 },  // Personalized Recommendation
];

export const SSlide3 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade through white flash from previous scene
  const flash = interpolate(frame, [0, 8, 18], [1, 0.7, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 90 } });
  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const opacity = fadeIn;

  // gentle zoom-out at the very end
  const endZoom = interpolate(frame, [180, 220], [1.0, 0.97], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const startZoom = interpolate(enter, [0, 1], [1.05, 1.0]);
  const scale = startZoom * endZoom;

  // CTA pulse in the final 30f (dark panel bottom)
  const ctaPulse = 0.5 + 0.5 * Math.sin((frame - 160) * 0.2);
  const ctaGlow = interpolate(frame, [150, 200], [0, 0.55], { extrapolateRight: "clamp" }) * ctaPulse;

  return (
    <AbsoluteFill style={{ opacity, overflow: "hidden" }}>
      <Img
        src={staticFile("images/slide-3.png")}
        style={{
          width: 1080,
          height: 1920,
          objectFit: "cover",
          transform: `scale(${scale})`,
        }}
      />
      {/* Staggered row highlights */}
      {ROWS.map((r, i) => {
        const start = 25 + i * 14;
        const local = frame - start;
        const rowOp = interpolate(local, [0, 10, 30, 50], [0, 0.9, 0.9, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const slideX = interpolate(local, [0, 20], [-30, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: r.left,
              top: r.top,
              width: r.width,
              height: r.height,
              borderRadius: 20,
              background: "linear-gradient(90deg, rgba(37,99,235,0.10) 0%, rgba(59,130,246,0.02) 100%)",
              boxShadow: "0 0 0 2px rgba(37,99,235,0.35)",
              opacity: rowOp,
              transform: `translateX(${slideX}px)`,
              pointerEvents: "none",
            }}
          />
        );
      })}
      {/* CTA panel glow */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 160,
          transform: "translateX(-50%)",
          width: 820,
          height: 130,
          borderRadius: 65,
          background: "radial-gradient(ellipse at center, rgba(59,130,246,0.7) 0%, transparent 70%)",
          opacity: ctaGlow,
          filter: "blur(18px)",
          pointerEvents: "none",
        }}
      />
      {/* Flash overlay */}
      <AbsoluteFill style={{ background: "#FFFFFF", opacity: flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
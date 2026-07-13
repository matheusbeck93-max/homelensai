import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

// Approximate rects for the 4 side cards on slide 2 (image is 1080x1920)
// Coords eyeballed from the reference image
const CARDS = [
  { left: 40, top: 720, width: 260, height: 260 },   // Budget (top-left)
  { left: 780, top: 720, width: 260, height: 260 },  // Preferences (top-right)
  { left: 20, top: 1060, width: 300, height: 340 },  // Preferred Areas (bottom-left)
  { left: 760, top: 1060, width: 300, height: 340 }, // Goals (bottom-right)
];

export const SSlide2 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });
  const enterX = interpolate(enter, [0, 1], [120, 0]);
  const fadeIn = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [190, 210], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = fadeIn * fadeOut;

  // subtle floating on the phone (center)
  const floatY = Math.sin(frame * 0.06) * 6;

  const exitScale = interpolate(frame, [190, 210], [1, 1.05], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity, overflow: "hidden" }}>
      <Img
        src={staticFile("images/slide-2.png")}
        style={{
          width: 1080,
          height: 1920,
          objectFit: "cover",
          transform: `translateX(${enterX}px) scale(${exitScale})`,
        }}
      />
      {/* Center phone floating overlay: mask the phone area by re-drawing a subtle shadow */}
      <div
        style={{
          position: "absolute",
          left: 300,
          top: 660 + floatY,
          width: 480,
          height: 780,
          borderRadius: 32,
          boxShadow: `0 30px 60px rgba(37,99,235,${0.08 + Math.abs(floatY) * 0.005})`,
          transform: `translateX(${enterX}px)`,
          pointerEvents: "none",
        }}
      />
      {/* Staggered highlight rings on cards */}
      {CARDS.map((c, i) => {
        const start = 30 + i * 18;
        const local = frame - start;
        const ringOp = interpolate(local, [0, 10, 25, 40], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const ringScale = interpolate(local, [0, 25], [0.92, 1.04], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: c.left,
              top: c.top,
              width: c.width,
              height: c.height,
              borderRadius: 24,
              boxShadow: "0 0 0 4px rgba(37,99,235,0.55), 0 0 40px rgba(59,130,246,0.35)",
              opacity: ringOp,
              transform: `translateX(${enterX}px) scale(${ringScale})`,
              transformOrigin: "center",
              pointerEvents: "none",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
import { AbsoluteFill, useCurrentFrame, interpolate, Img, staticFile } from "remotion";

interface Props {
  colors: Record<string, string>;
}

export const PersistentBackground = ({ colors }: Props) => {
  const frame = useCurrentFrame();

  const gradientAngle = interpolate(frame, [0, 800], [135, 210]);
  const pulse = Math.sin(frame * 0.02) * 5;

  return (
    <AbsoluteFill>
      <div
        style={{
          width: "100%",
          height: "100%",
          background: `linear-gradient(${gradientAngle}deg, ${colors.dark} 0%, ${colors.darkMid} ${50 + pulse}%, ${colors.dark} 100%)`,
        }}
      />

      {/* Logo watermark integrated into background */}
      {[
        { x: 15, y: 10, size: 220, opacity: 0.04, speed: 0.008 },
        { x: 70, y: 60, size: 180, opacity: 0.03, speed: 0.012 },
        { x: 40, y: 80, size: 140, opacity: 0.025, speed: 0.01 },
      ].map((logo, i) => {
        const floatY = Math.sin(frame * logo.speed + i * 2) * 20;
        const floatX = Math.cos(frame * logo.speed * 0.7 + i) * 10;
        const rot = Math.sin(frame * 0.005 + i * 1.5) * 8;
        return (
          <div
            key={`logo-${i}`}
            style={{
              position: "absolute",
              left: `${logo.x + floatX * 0.1}%`,
              top: `${logo.y}%`,
              transform: `translateY(${floatY}px) rotate(${rot}deg)`,
              opacity: logo.opacity + Math.sin(frame * 0.015 + i) * 0.01,
            }}
          >
            <Img
              src={staticFile("images/logo.png")}
              style={{ width: logo.size, height: logo.size, objectFit: "contain" }}
            />
          </div>
        );
      })}

      {/* Soft glowing orbs */}
      {[0, 1, 2].map((i) => {
        const x = interpolate(frame, [0, 800], [10 + i * 30, 20 + i * 25]);
        const y = 30 + Math.sin(frame * 0.015 + i * 2) * 15;
        const opacity = 0.07 + Math.sin(frame * 0.01 + i) * 0.03;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: 350 + i * 80,
              height: 350 + i * 80,
              borderRadius: "50%",
              background: i % 2 === 0 ? colors.primary : colors.accent,
              opacity,
              filter: "blur(80px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

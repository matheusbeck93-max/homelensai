import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

interface Props {
  colors: Record<string, string>;
}

export const PersistentBackground = ({ colors }: Props) => {
  const frame = useCurrentFrame();

  const gradientAngle = interpolate(frame, [0, 600], [135, 200]);
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
      {[0, 1, 2].map((i) => {
        const x = interpolate(frame, [0, 600], [10 + i * 30, 20 + i * 25]);
        const y = 30 + Math.sin(frame * 0.015 + i * 2) * 15;
        const opacity = 0.08 + Math.sin(frame * 0.01 + i) * 0.04;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: 400 + i * 100,
              height: 400 + i * 100,
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

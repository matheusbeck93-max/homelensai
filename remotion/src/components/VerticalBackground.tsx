import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

interface Props {
  colors: Record<string, string>;
}

export const VerticalBackground = ({ colors }: Props) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <div
        style={{
          width: "100%",
          height: "100%",
          background: `linear-gradient(180deg, ${colors.dark} 0%, ${colors.darkMid} 50%, ${colors.primaryDark} 100%)`,
        }}
      />
      {[0, 1, 2].map((i) => {
        const x = interpolate(frame, [0, 900], [20 + i * 20, 30 + i * 15]);
        const y = interpolate(
          Math.sin(frame * 0.008 + i * 2),
          [-1, 1],
          [15, 85]
        );
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: 300 + i * 80,
              height: 300 + i * 80,
              borderRadius: "50%",
              background: `radial-gradient(circle, rgba(107,141,181,${0.06 + i * 0.02}) 0%, transparent 70%)`,
              transform: "translate(-50%, -50%)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

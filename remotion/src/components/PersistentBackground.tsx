import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

interface Props {
  colors: Record<string, string>;
}

export const PersistentBackground = ({ colors }: Props) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <div
        style={{
          width: "100%",
          height: "100%",
          background: `linear-gradient(135deg, ${colors.dark} 0%, ${colors.darkMid} 40%, ${colors.primaryDark} 100%)`,
        }}
      />
      {[0, 1, 2].map((i) => {
        const x = interpolate(frame, [0, 900], [10 + i * 30, 20 + i * 25]);
        const y = interpolate(
          Math.sin(frame * 0.008 + i * 2),
          [-1, 1],
          [20, 80]
        );
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
              background: `radial-gradient(circle, rgba(107,141,181,${0.06 + i * 0.02}) 0%, transparent 70%)`,
              transform: "translate(-50%, -50%)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

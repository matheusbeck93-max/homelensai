import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

interface Props { colors: Record<string, string>; }

const QUESTIONS = [
  { text: "Is this a good deal?", delay: 25, x: -220, y: -420 },
  { text: "Why has it been on the market so long?", delay: 50, x: 180, y: -220 },
  { text: "Are there hidden issues?", delay: 75, x: -240, y: 260 },
  { text: "Is the neighborhood right?", delay: 100, x: 200, y: 440 },
];

export const CScene2Problem = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [135, 149], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = fadeIn * fadeOut;

  const cardScale = interpolate(spring({ frame, fps, config: { damping: 22, stiffness: 90 } }), [0, 1], [0.85, 1]);

  return (
    <AbsoluteFill style={{ fontFamily, opacity: op, justifyContent: "center", alignItems: "center" }}>
      {/* Center listing card */}
      <div style={{
        width: 560, transform: `scale(${cardScale})`,
        background: "rgba(255,255,255,0.08)", borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
      }}>
        <div style={{
          width: "100%", height: 360,
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})`,
          position: "relative",
        }}>
          {/* Roof triangle */}
          <div style={{
            position: "absolute", left: "50%", top: 90, transform: "translateX(-50%)",
            width: 0, height: 0,
            borderLeft: "110px solid transparent",
            borderRight: "110px solid transparent",
            borderBottom: `80px solid ${colors.offWhite}22`,
          }} />
          <div style={{
            position: "absolute", left: "50%", bottom: 60, transform: "translateX(-50%)",
            width: 180, height: 120,
            background: `${colors.offWhite}22`, borderRadius: 4,
          }} />
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: colors.white }}>$687,000</div>
          <div style={{ fontSize: 20, color: colors.muted, marginTop: 6 }}>4 bd · 3 ba · 2,180 sqft</div>
          <div style={{ fontSize: 15, color: colors.mutedDark, marginTop: 8 }}>Listed 84 days ago</div>
        </div>
      </div>

      {/* Floating questions */}
      {QUESTIONS.map((q, i) => {
        const qOp = interpolate(frame, [q.delay, q.delay + 15], [0, 1], { extrapolateRight: "clamp" });
        const qY = interpolate(
          spring({ frame: frame - q.delay, fps, config: { damping: 18 } }),
          [0, 1], [q.y + 30, q.y]
        );
        return (
          <div key={i} style={{
            position: "absolute", left: "50%", top: "50%",
            transform: `translate(-50%, -50%) translate(${q.x}px, ${qY}px)`,
            opacity: qOp,
            padding: "14px 22px",
            background: `${colors.dark}dd`,
            border: `1px solid ${colors.primary}55`,
            borderRadius: 999,
            fontSize: 22, fontWeight: 500, color: colors.white,
            whiteSpace: "nowrap",
            boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
          }}>
            {q.text}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
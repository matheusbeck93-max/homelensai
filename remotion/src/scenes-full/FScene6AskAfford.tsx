import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

interface Props { colors: Record<string, string>; }

export const FScene6AskAfford = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [105, 119], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = fadeIn * fadeOut;

  const headOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const headY = interpolate(spring({ frame, fps, config: { damping: 22 } }), [0, 1], [24, 0]);
  const chatY = interpolate(spring({ frame: frame - 18, fps, config: { damping: 22 } }), [0, 1], [40, 0]);
  const chatOp = interpolate(frame, [18, 38], [0, 1], { extrapolateRight: "clamp" });
  const affY = interpolate(spring({ frame: frame - 38, fps, config: { damping: 22 } }), [0, 1], [40, 0]);
  const affOp = interpolate(frame, [38, 58], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, opacity: op, padding: "150px 60px 80px", flexDirection: "column", gap: 30 }}>
      <div style={{ textAlign: "center", opacity: headOp, transform: `translateY(${headY}px)`, marginBottom: 20 }}>
        <div style={{ fontSize: 48, fontWeight: 700, color: colors.white, letterSpacing: -1, lineHeight: 1.15 }}>
          Ask anything.{"\n"}Know what you can afford.
        </div>
      </div>

      {/* Chat card */}
      <div style={{
        opacity: chatOp, transform: `translateY(${chatY}px)`,
        background: "rgba(255,255,255,0.07)", border: `1px solid ${colors.primary}33`,
        borderRadius: 20, padding: 24,
      }}>
        <div style={{ fontSize: 14, letterSpacing: 2, textTransform: "uppercase", color: colors.accent, fontWeight: 500, marginBottom: 12 }}>
          AI Chat
        </div>
        <div style={{
          background: `${colors.primary}22`, borderRadius: 14, padding: "14px 16px",
          fontSize: 20, color: colors.white, marginBottom: 12,
        }}>Is 742 Maple Ave a smart buy for $535k?</div>
        <div style={{
          background: colors.dark, borderRadius: 14, padding: "14px 16px",
          fontSize: 18, color: colors.offWhite, lineHeight: 1.5,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{
              padding: "4px 10px", background: colors.success, borderRadius: 999,
              fontSize: 14, fontWeight: 700, color: colors.white,
            }}>Match 8.4/10</div>
          </div>
          Strong fundamentals: priced ~4% below Zestimate, low flood risk, top-decile schools.
        </div>
      </div>

      {/* Affordability card */}
      <div style={{
        opacity: affOp, transform: `translateY(${affY}px)`,
        background: "rgba(255,255,255,0.07)", border: `1px solid ${colors.primary}33`,
        borderRadius: 20, padding: 24,
      }}>
        <div style={{ fontSize: 14, letterSpacing: 2, textTransform: "uppercase", color: colors.accent, fontWeight: 500, marginBottom: 12 }}>
          Buying Power
        </div>
        <div style={{ fontSize: 20, color: colors.muted, marginBottom: 6 }}>Home price you can afford</div>
        <div style={{ fontSize: 64, fontWeight: 700, color: colors.white, letterSpacing: -1.5 }}>$612,400</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, gap: 16 }}>
          {[["Monthly", "$3,140"], ["Rate", "6.5%"], ["Down", "20%"]].map(([k, v]) => (
            <div key={k} style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: colors.mutedDark }}>{k}</div>
              <div style={{ fontSize: 20, color: colors.white, fontWeight: 700, marginTop: 4 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
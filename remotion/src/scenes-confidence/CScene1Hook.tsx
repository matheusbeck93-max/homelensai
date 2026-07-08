import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

interface Props { colors: Record<string, string>; }

const SITES = ["Zillow", "Realtor.com", "Redfin", "Trulia", "Homes.com", "Zillow", "Realtor.com", "Redfin"];

export const CScene1Hook = ({ colors }: Props) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [75, 89], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = fadeIn * fadeOut;

  // Fast upward scroll
  const scroll = interpolate(frame, [0, 90], [0, -1600]);

  // Browser tabs across top
  const tabs = ["Zillow", "Realtor", "Redfin", "Trulia", "Homes"];

  // Cursor darting
  const cursorX = 540 + Math.sin(frame * 0.35) * 320;
  const cursorY = 900 + Math.cos(frame * 0.42) * 380;

  const textOp = interpolate(frame, [45, 65], [0, 1], { extrapolateRight: "clamp" }) * fadeOut;

  return (
    <AbsoluteFill style={{ fontFamily, opacity: op, overflow: "hidden" }}>
      {/* Faux browser chrome */}
      <div style={{
        position: "absolute", top: 60, left: 40, right: 40, height: 60,
        background: "rgba(255,255,255,0.06)", borderRadius: 12, display: "flex", alignItems: "center",
        padding: "0 16px", gap: 8, border: "1px solid rgba(255,255,255,0.08)",
      }}>
        {tabs.map((t, i) => (
          <div key={i} style={{
            padding: "8px 14px", borderRadius: 8, fontSize: 16,
            background: i === (Math.floor(frame / 8) % tabs.length) ? "rgba(107,141,181,0.35)" : "rgba(255,255,255,0.04)",
            color: colors.white, fontWeight: 500,
          }}>{t}</div>
        ))}
      </div>

      {/* Scrolling listing cards */}
      <div style={{ position: "absolute", top: 180, left: 40, right: 40, bottom: 0, overflow: "hidden" }}>
        <div style={{ transform: `translateY(${scroll}px)`, display: "flex", flexDirection: "column", gap: 24 }}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} style={{
              display: "flex", gap: 18, padding: 18,
              background: "rgba(255,255,255,0.06)", borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{
                width: 240, height: 180, borderRadius: 12,
                background: `linear-gradient(135deg, ${colors.primary}88, ${colors.primaryDark}88)`,
              }} />
              <div style={{ flex: 1, paddingTop: 8 }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: colors.white }}>
                  ${(450 + i * 37).toLocaleString()},000
                </div>
                <div style={{ fontSize: 18, color: colors.muted, marginTop: 8 }}>
                  {3 + (i % 3)} bd · {2 + (i % 2)} ba · {1400 + i * 80} sqft
                </div>
                <div style={{ fontSize: 15, color: colors.mutedDark, marginTop: 8 }}>
                  {SITES[i % SITES.length]}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cursor */}
      <div style={{
        position: "absolute", left: cursorX, top: cursorY,
        width: 0, height: 0,
        borderLeft: "12px solid transparent",
        borderRight: "12px solid transparent",
        borderTop: `20px solid ${colors.white}`,
        transform: "rotate(-30deg)",
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
      }} />

      {/* Bottom fade overlay for text legibility */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: 600,
        background: `linear-gradient(180deg, transparent 0%, ${colors.dark}ee 60%, ${colors.dark} 100%)`,
      }} />

      {/* Text */}
      <div style={{
        position: "absolute", left: 60, right: 60, bottom: 180, textAlign: "center",
        opacity: textOp,
      }}>
        <div style={{ fontSize: 46, fontWeight: 700, color: colors.white, lineHeight: 1.25, letterSpacing: -0.5 }}>
          Searching for your{"\n"}next home shouldn't{"\n"}feel like this.
        </div>
      </div>
    </AbsoluteFill>
  );
};
import { AbsoluteFill, Sequence } from "remotion";
import { Scene1Intro } from "./scenes/Scene1Intro";
import { Scene2AIChat } from "./scenes/Scene2AIChat";
import { Scene3BuyingPower } from "./scenes/Scene3BuyingPower";
import { Scene4Mortgage } from "./scenes/Scene4Mortgage";
import { Scene5Investor } from "./scenes/Scene5Investor";
import { Scene6AIInsight } from "./scenes/Scene6AIInsight";
import { Scene7Closing } from "./scenes/Scene7Closing";
import { PersistentBackground } from "./components/PersistentBackground";

export const COLORS = {
  primary: "#6B8DB5",
  primaryLight: "#8AADD0",
  primaryDark: "#4A6E94",
  accent: "#A3C4E0",
  dark: "#2C3E55",
  darkMid: "#3A5068",
  white: "#FFFFFF",
  offWhite: "#F0F4F8",
  muted: "#B0C4D8",
  mutedDark: "#7A95AD",
};

// 7 scenes, no overlapping transitions — simple sequential cuts with crossfade built into each scene
// Scene 1: Intro logo          — frames 0-119     (4s)
// Scene 2: AI Chat             — frames 120-299   (6s)
// Scene 3: Buying Power        — frames 300-449   (5s)
// Scene 4: Mortgage + PITI     — frames 450-599   (5s)
// Scene 5: Investor Calc       — frames 600-729   (4.3s)
// Scene 6: AI Insight          — frames 730-809   (2.7s)
// Scene 7: Closing logo        — frames 810-899   (3s)

export const MainVideo = () => {
  return (
    <AbsoluteFill>
      <PersistentBackground colors={COLORS} />

      <Sequence from={0} durationInFrames={120}>
        <Scene1Intro colors={COLORS} />
      </Sequence>

      <Sequence from={120} durationInFrames={180}>
        <Scene2AIChat colors={COLORS} />
      </Sequence>

      <Sequence from={300} durationInFrames={150}>
        <Scene3BuyingPower colors={COLORS} />
      </Sequence>

      <Sequence from={450} durationInFrames={150}>
        <Scene4Mortgage colors={COLORS} />
      </Sequence>

      <Sequence from={600} durationInFrames={130}>
        <Scene5Investor colors={COLORS} />
      </Sequence>

      <Sequence from={730} durationInFrames={80}>
        <Scene6AIInsight colors={COLORS} />
      </Sequence>

      <Sequence from={810} durationInFrames={90}>
        <Scene7Closing colors={COLORS} />
      </Sequence>
    </AbsoluteFill>
  );
};

import { AbsoluteFill, Sequence } from "remotion";
import { Scene1Intro } from "./scenes/Scene1Intro";
import { Scene2AIChat } from "./scenes/Scene2AIChat";
import { Scene3BuyingPower } from "./scenes/Scene3BuyingPower";
import { Scene4Mortgage } from "./scenes/Scene4Mortgage";
import { Scene5Investor } from "./scenes/Scene5Investor";
import { Scene6AIInsight } from "./scenes/Scene6AIInsight";
import { Scene7Extension } from "./scenes/Scene7Extension";
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

// 8 scenes, sequential cuts — 30s @ 30fps = 900 frames
// Scene 1: Intro logo          — frames 0-99      (3.3s)
// Scene 2: AI Chat             — frames 100-259    (5.3s)
// Scene 3: Buying Power        — frames 260-389    (4.3s)
// Scene 4: Mortgage + PITI     — frames 390-519    (4.3s)
// Scene 5: Investor Calc       — frames 520-639    (4s)
// Scene 6: AI Insight          — frames 640-719    (2.7s)
// Scene 7: Chrome Extension    — frames 720-819    (3.3s)
// Scene 8: Closing logo        — frames 820-899    (2.7s)

export const MainVideo = () => {
  return (
    <AbsoluteFill>
      <PersistentBackground colors={COLORS} />

      <Sequence from={0} durationInFrames={100}>
        <Scene1Intro colors={COLORS} />
      </Sequence>

      <Sequence from={100} durationInFrames={160}>
        <Scene2AIChat colors={COLORS} />
      </Sequence>

      <Sequence from={260} durationInFrames={130}>
        <Scene3BuyingPower colors={COLORS} />
      </Sequence>

      <Sequence from={390} durationInFrames={130}>
        <Scene4Mortgage colors={COLORS} />
      </Sequence>

      <Sequence from={520} durationInFrames={120}>
        <Scene5Investor colors={COLORS} />
      </Sequence>

      <Sequence from={640} durationInFrames={80}>
        <Scene6AIInsight colors={COLORS} />
      </Sequence>

      <Sequence from={720} durationInFrames={100}>
        <Scene7Extension colors={COLORS} />
      </Sequence>

      <Sequence from={820} durationInFrames={80}>
        <Scene7Closing colors={COLORS} />
      </Sequence>
    </AbsoluteFill>
  );
};

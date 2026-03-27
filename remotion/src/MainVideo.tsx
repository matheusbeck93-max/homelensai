import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Scene1Intro } from "./scenes/Scene1Intro";
import { Scene2AIChat } from "./scenes/Scene2AIChat";
import { Scene3BuyingPower } from "./scenes/Scene3BuyingPower";
import { Scene4Mortgage } from "./scenes/Scene4Mortgage";
import { Scene5Investor } from "./scenes/Scene5Investor";
import { Scene6AIInsight } from "./scenes/Scene6AIInsight";
import { Scene7Closing } from "./scenes/Scene7Closing";
import { PersistentBackground } from "./components/PersistentBackground";

const COLORS = {
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

const TRANSITION = springTiming({ config: { damping: 200 }, durationInFrames: 20 });

export const MainVideo = () => {
  return (
    <AbsoluteFill>
      <PersistentBackground colors={COLORS} />

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={100}>
          <Scene1Intro colors={COLORS} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={TRANSITION} />

        <TransitionSeries.Sequence durationInFrames={130}>
          <Scene2AIChat colors={COLORS} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={slide({ direction: "from-left" })} timing={TRANSITION} />

        <TransitionSeries.Sequence durationInFrames={110}>
          <Scene3BuyingPower colors={COLORS} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={TRANSITION} />

        <TransitionSeries.Sequence durationInFrames={120}>
          <Scene4Mortgage colors={COLORS} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={TRANSITION} />

        <TransitionSeries.Sequence durationInFrames={110}>
          <Scene5Investor colors={COLORS} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={TRANSITION} />

        <TransitionSeries.Sequence durationInFrames={110}>
          <Scene6AIInsight colors={COLORS} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={TRANSITION} />

        <TransitionSeries.Sequence durationInFrames={110}>
          <Scene7Closing colors={COLORS} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

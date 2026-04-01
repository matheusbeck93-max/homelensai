import { AbsoluteFill, Sequence } from "remotion";
import { VScene1Intro } from "./scenes-vertical/VScene1Intro";
import { VScene2AIChat } from "./scenes-vertical/VScene2AIChat";
import { VScene3BuyingPower } from "./scenes-vertical/VScene3BuyingPower";
import { VScene4Mortgage } from "./scenes-vertical/VScene4Mortgage";
import { VScene5Investor } from "./scenes-vertical/VScene5Investor";
import { VScene6AIInsight } from "./scenes-vertical/VScene6AIInsight";
import { VScene7Closing } from "./scenes-vertical/VScene7Closing";
import { VerticalBackground } from "./components/VerticalBackground";

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

export const VerticalVideo = () => {
  return (
    <AbsoluteFill>
      <VerticalBackground colors={COLORS} />

      <Sequence from={0} durationInFrames={120}>
        <VScene1Intro colors={COLORS} />
      </Sequence>

      <Sequence from={120} durationInFrames={180}>
        <VScene2AIChat colors={COLORS} />
      </Sequence>

      <Sequence from={300} durationInFrames={150}>
        <VScene3BuyingPower colors={COLORS} />
      </Sequence>

      <Sequence from={450} durationInFrames={150}>
        <VScene4Mortgage colors={COLORS} />
      </Sequence>

      <Sequence from={600} durationInFrames={130}>
        <VScene5Investor colors={COLORS} />
      </Sequence>

      <Sequence from={730} durationInFrames={80}>
        <VScene6AIInsight colors={COLORS} />
      </Sequence>

      <Sequence from={810} durationInFrames={90}>
        <VScene7Closing colors={COLORS} />
      </Sequence>
    </AbsoluteFill>
  );
};

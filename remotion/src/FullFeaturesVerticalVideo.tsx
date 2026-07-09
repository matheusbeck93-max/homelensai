import { AbsoluteFill, Sequence } from "remotion";
import { VerticalBackground } from "./components/VerticalBackground";
import { FScene1Logo } from "./scenes-full/FScene1Logo";
import { FScene2Hero } from "./scenes-full/FScene2Hero";
import { FScene3Capabilities } from "./scenes-full/FScene3Capabilities";
import { FScene4Extension } from "./scenes-full/FScene4Extension";
import { FScene5Investor } from "./scenes-full/FScene5Investor";
import { FScene6AskAfford } from "./scenes-full/FScene6AskAfford";
import { FScene7Pricing } from "./scenes-full/FScene7Pricing";
import { FScene8Close } from "./scenes-full/FScene8Close";

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
  success: "#4A9E7A",
};

export const FullFeaturesVerticalVideo = () => (
  <AbsoluteFill>
    <VerticalBackground colors={COLORS} />
    <Sequence from={0} durationInFrames={75}>
      <FScene1Logo colors={COLORS} />
    </Sequence>
    <Sequence from={75} durationInFrames={105}>
      <FScene2Hero colors={COLORS} />
    </Sequence>
    <Sequence from={180} durationInFrames={150}>
      <FScene3Capabilities colors={COLORS} />
    </Sequence>
    <Sequence from={330} durationInFrames={120}>
      <FScene4Extension colors={COLORS} />
    </Sequence>
    <Sequence from={450} durationInFrames={165}>
      <FScene5Investor colors={COLORS} />
    </Sequence>
    <Sequence from={615} durationInFrames={120}>
      <FScene6AskAfford colors={COLORS} />
    </Sequence>
    <Sequence from={735} durationInFrames={105}>
      <FScene7Pricing colors={COLORS} />
    </Sequence>
    <Sequence from={840} durationInFrames={60}>
      <FScene8Close colors={COLORS} />
    </Sequence>
  </AbsoluteFill>
);
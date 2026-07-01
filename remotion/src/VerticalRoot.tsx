import { Composition } from "remotion";
import { VerticalVideo } from "./VerticalVideo";
import { InvestorVerticalVideo, INVESTOR_VERTICAL_DURATION } from "./InvestorVerticalVideo";
import { ExtensionVerticalVideo, EXTENSION_VERTICAL_DURATION } from "./ExtensionVerticalVideo";

export const VerticalRemotionRoot = () => (
  <>
  <Composition
    id="vertical"
    component={VerticalVideo}
    durationInFrames={900}
    fps={30}
    width={1080}
    height={1920}
  />
    <Composition
      id="investor-vertical"
      component={InvestorVerticalVideo}
      durationInFrames={INVESTOR_VERTICAL_DURATION}
      fps={30}
      width={1080}
      height={1920}
    />
    <Composition
      id="extension-vertical"
      component={ExtensionVerticalVideo}
      durationInFrames={EXTENSION_VERTICAL_DURATION}
      fps={30}
      width={1080}
      height={1920}
    />
  </>
);

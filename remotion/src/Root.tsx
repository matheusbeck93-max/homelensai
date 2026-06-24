import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { LaunchVideo } from "./LaunchVideo";
import { FeaturesVideo, FEATURES_DURATION } from "./FeaturesVideo";

// 30 seconds @ 30fps = 900 frames
export const RemotionRoot = () => (
  <>
  <Composition
    id="main"
    component={MainVideo}
    durationInFrames={900}
    fps={30}
    width={1920}
    height={1080}
  />
    <Composition
      id="launch"
      component={LaunchVideo}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="features"
      component={FeaturesVideo}
      durationInFrames={FEATURES_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
);

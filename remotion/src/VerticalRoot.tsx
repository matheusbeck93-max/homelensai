import { Composition } from "remotion";
import { VerticalVideo } from "./VerticalVideo";

export const VerticalRemotionRoot = () => (
  <Composition
    id="vertical"
    component={VerticalVideo}
    durationInFrames={900}
    fps={30}
    width={1080}
    height={1920}
  />
);

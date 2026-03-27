import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

// 7 scenes: 100+130+110+120+110+110+110 = 790
// 6 transitions × 20 frames = 120 overlap
// Total: 790 - 120 = 670
export const RemotionRoot = () => (
  <Composition
    id="main"
    component={MainVideo}
    durationInFrames={670}
    fps={30}
    width={1920}
    height={1080}
  />
);

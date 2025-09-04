declare module "expo-av" {
  import * as React from "react";
  import { ViewStyle } from "react-native";

  export interface VideoProps {
    source: any;
    rate?: number;
    volume?: number;
    isMuted?: boolean;
    resizeMode?: any;
    shouldPlay?: boolean;
    useNativeControls?: boolean;
    style?: ViewStyle | ViewStyle[];
  }

  export class Video extends React.Component<VideoProps> {}
}

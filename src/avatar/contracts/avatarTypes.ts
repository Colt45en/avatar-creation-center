export type AvatarSurfaceMode =
  | "white_on_black"
  | "white_on_alpha"
  | "binary_mask"
  | "grayscale_depth"
  | "reference_sheet";

export interface Point2D {
  x: number;
  y: number;
}

export interface AvatarLandmarks {
  head: Point2D;
  neck: Point2D;
  chest: Point2D;
  pelvis: Point2D;
  leftShoulder: Point2D;
  rightShoulder: Point2D;
  leftElbow: Point2D;
  rightElbow: Point2D;
  leftHand: Point2D;
  rightHand: Point2D;
  leftKnee: Point2D;
  rightKnee: Point2D;
  leftFoot: Point2D;
  rightFoot: Point2D;
}

export interface AvatarSettings {
  mode: AvatarSurfaceMode;
  centered: boolean;
  normalizedScale: boolean;
  poseLocked: boolean;
  threshold: number;
  edgeCleanup: boolean;
  outputSize: number;
}

export interface AvatarManifest {
  avatarId: string;
  version: string;
  sourceImageHash: string;
  createdAt: string;
  outputs: {
    base: string;
    mask?: string;
    alpha?: string;
    thumb256?: string;
    thumb64?: string;
    landmarks?: string;
    model?: string;
  };
  settings: AvatarSettings;
  landmarks?: AvatarLandmarks;
}

export interface ProcessedAvatar {
  manifest: AvatarManifest;
  assets: {
    base: string; // Data URL
    alpha: string;
    mask: string;
    thumb256: string;
    thumb64: string;
    model?: string; // Base64 Data URL of the GLB
  };
  landmarks: AvatarLandmarks;
}

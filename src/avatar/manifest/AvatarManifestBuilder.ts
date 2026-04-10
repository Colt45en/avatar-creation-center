import { AvatarManifest, AvatarSettings, AvatarLandmarks } from '../contracts/avatarTypes';

export class AvatarManifestBuilder {
  static build(settings: AvatarSettings, file: File, landmarks: AvatarLandmarks): AvatarManifest {
    return {
      avatarId: `avatar_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      version: "1.1.0",
      sourceImageHash: file.name, // Simplified for Phase 0/1
      createdAt: new Date().toISOString(),
      outputs: {
        base: "avatar_base.png",
        mask: "avatar_mask.png",
        alpha: "avatar_alpha.png",
        thumb256: "avatar_thumb_256.png",
        thumb64: "avatar_thumb_64.png",
        landmarks: "landmarks.json",
        model: "avatar.glb"
      },
      settings,
      landmarks
    };
  }
}

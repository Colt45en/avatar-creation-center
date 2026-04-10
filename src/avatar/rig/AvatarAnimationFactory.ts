import * as THREE from 'three';

export class AvatarAnimationFactory {
  static createIdle(): THREE.AnimationClip {
    const times = [0, 1, 2];
    const tracks = [
      this.makeTrack('lShoulder', times, [0, 0.2, 0]),
      this.makeTrack('rShoulder', times, [0, -0.2, 0]),
      this.makeTrack('lElbow', times, [0, 0.3, 0]),
      this.makeTrack('rElbow', times, [0, -0.3, 0]),
      this.makeTrack('spine', times, [0, 0.05, 0]),
      this.makeTrack('chest', times, [0, 0.1, 0]),
      this.makeTrack('head', times, [0, 0.15, 0]),
    ];
    return new THREE.AnimationClip('idle', 2, tracks);
  }

  static createWalk(): THREE.AnimationClip {
    const times = [0, 0.5, 1];
    const tracks = [
      this.makeTrack('lShoulder', times, [0.8, -0.8, 0.8]),
      this.makeTrack('rShoulder', times, [-0.8, 0.8, -0.8]),
      this.makeTrack('lElbow', times, [0.3, 0.6, 0.3]),
      this.makeTrack('rElbow', times, [-0.6, -0.3, -0.6]),
      this.makeTrack('spine', times, [0.1, -0.1, 0.1]),
      this.makeTrack('chest', times, [0.1, -0.1, 0.1]),
      this.makeTrack('lKnee', times, [-1.0, 0.3, -1.0]),
      this.makeTrack('rKnee', times, [0.3, -1.0, 0.3]),
      this.makeTrack('lFoot', times, [0.3, -0.2, 0.3]),
      this.makeTrack('rFoot', times, [-0.2, 0.3, -0.2]),
    ];
    return new THREE.AnimationClip('walk', 1, tracks);
  }

  static createWave(): THREE.AnimationClip {
    const times = [0, 0.25, 0.5, 0.75, 1];
    const tracks = [
      this.makeTrack('rShoulder', times, [-2.8, -2.8, -2.8, -2.8, -2.8]), // Arm raised high
      this.makeTrack('rElbow', times, [0, -0.8, 0, -0.8, 0]), // Waving back and forth
      this.makeTrack('head', times, [0.2, 0.2, 0.2, 0.2, 0.2]), // Looking slightly towards the wave
    ];
    return new THREE.AnimationClip('wave', 1, tracks);
  }

  private static makeTrack(boneName: string, times: number[], angles: number[]) {
    const values = [];
    for (const a of angles) {
      // Rotate around the Z axis (2D plane)
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);
      values.push(q.x, q.y, q.z, q.w);
    }
    return new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, values);
  }
}

import * as THREE from 'three';

/**
 * Extracted from Runbook 2.45B: Morph Poses → Auto Clips
 * Auto-creates short animation clips (blink, smile, idle-breath) for a GLB with morph targets.
 */
export function addAutoMorphClips(
  gltfScene: THREE.Object3D,
  blink = 'Blink',
  smile = 'Smile'
): THREE.AnimationClip | null {
  const mesh = gltfScene.getObjectByProperty('isMesh', true) as THREE.Mesh & { morphTargetDictionary?: Record<string, number> };
  
  if (!mesh || !mesh.morphTargetDictionary) {
    console.warn('No morph targets found on the provided mesh.');
    return null;
  }

  const dict = mesh.morphTargetDictionary;
  const tracks: THREE.KeyframeTrack[] = [];

  const mk = (name: string, times: number[], values: number[]) => {
    if (dict[name] === undefined) return;
    tracks.push(new THREE.NumberKeyframeTrack(`${mesh.uuid}.morphTargetInfluences[${dict[name]}]`, times, values));
  };

  // Blink (0→1→0 over 0.3s)
  mk(blink, [0, 0.15, 0.3], [0, 1, 0]);

  // Smile (0→0.8→0 over 1.2s)
  mk(smile, [0, 0.6, 1.2], [0, 0.8, 0]);

  // Idle breath (sinus between 0..0.25 over 4s)
  const breathIdx = Object.keys(dict)[0]; // Use any morph as chest proxy if none named
  if (breathIdx) {
    mk(breathIdx, [0, 1, 2, 3, 4], [0, 0.25, 0, 0.25, 0]);
  }

  if (tracks.length === 0) return null;

  return new THREE.AnimationClip('autoClips', -1, tracks);
}

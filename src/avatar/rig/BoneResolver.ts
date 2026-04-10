export const BONE_ALIASES: Record<string, string[]> = {
  Hips: ['Hips', 'Hip', 'mixamorigHips', 'mixamorig:Hips', 'Pelvis'],
  Spine: ['Spine', 'Spine0', 'mixamorigSpine', 'mixamorig:Spine'],
  Spine1: ['Spine1', 'Spine01', 'mixamorigSpine1', 'mixamorig:Spine1', 'TorsoAnchor1'],
  Spine2: ['Spine2', 'Spine02', 'mixamorigSpine2', 'mixamorig:Spine2', 'Chest', 'TorsoAnchor2'],
  Neck: ['Neck', 'mixamorigNeck', 'mixamorig:Neck', 'NeckAnchor'],
  Head: ['Head', 'mixamorigHead', 'mixamorig:Head', 'HeadTop'],
  LeftUpperArm: ['LeftUpperArm', 'LeftArm', 'mixamorigLeftArm', 'Shoulder_L'],
  LeftLowerArm: ['LeftLowerArm', 'LeftForeArm', 'mixamorigLeftForeArm', 'Elbow_L'],
  LeftHand: ['LeftHand', 'mixamorigLeftHand', 'mixamorig:LeftHand', 'Wrist_L'],
  RightUpperArm: ['RightUpperArm', 'RightArm', 'mixamorigRightArm', 'Shoulder_R'],
  RightLowerArm: ['RightLowerArm', 'RightForeArm', 'mixamorigRightForeArm', 'Elbow_R'],
  RightHand: ['RightHand', 'mixamorigRightHand', 'mixamorig:RightHand', 'Wrist_R'],
  LeftUpperLeg: ['LeftUpperLeg', 'LeftUpLeg', 'mixamorigLeftUpLeg', 'Hip_L'],
  LeftLowerLeg: ['LeftLowerLeg', 'LeftLeg', 'mixamorigLeftLeg', 'Knee_L'],
  LeftFoot: ['LeftFoot', 'mixamorigLeftFoot', 'mixamorig:LeftFoot', 'Ankle_L'],
  RightUpperLeg: ['RightUpperLeg', 'RightUpLeg', 'mixamorigRightUpLeg', 'Hip_R'],
  RightLowerLeg: ['RightLowerLeg', 'RightLeg', 'mixamorigRightLeg', 'Knee_R'],
  RightFoot: ['RightFoot', 'mixamorigRightFoot', 'mixamorig:RightFoot', 'Ankle_R'],
};

export function normBoneName(s: string) { 
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); 
}

export function resolveBoneByAliases(skeleton: THREE.Skeleton, canonicalName: string): THREE.Bone | null {
  if(!skeleton || !skeleton.bones) return null;
  const candidates = BONE_ALIASES[canonicalName] || [canonicalName];
  const byNorm = new Map(skeleton.bones.map(b => [normBoneName(b.name), b]));
  for (const c of candidates) { 
      const hit = byNorm.get(normBoneName(c)); 
      if (hit) return hit; 
  }
  const want = normBoneName(candidates[0]);
  for (const b of skeleton.bones) { 
      const n = normBoneName(b.name); 
      if (n.endsWith(want) || n.includes(want)) return b; 
  }
  return null;
}

export function findBoneLoose(root: THREE.Object3D, want: string): THREE.Bone | null {
  let found: THREE.Bone | null = null;
  const w = normBoneName(want);
  root.traverse(o => {
      if (o.type === 'Bone' && !found) {
          const n = normBoneName(o.name);
          if(n === w || n.endsWith(w) || n.includes(w)) found = o as THREE.Bone;
      }
  });
  return found;
}

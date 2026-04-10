import * as THREE from 'three';

export function buildBasis_YForward(forward: THREE.Vector3, sideRef: THREE.Vector3) {
  const y = forward.clone().normalize();
  let x = new THREE.Vector3().crossVectors(sideRef, y);
  if (x.lengthSq() < 1e-10) {
      const fallback = Math.abs(y.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      x.crossVectors(fallback, y);
  }
  x.normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  x.crossVectors(y, z).normalize();
  return { x, y, z };
}

export function worldDirToParentLocalDir(dirW: THREE.Vector3, parentW_Q: THREE.Quaternion) {
  return dirW.clone().applyQuaternion(parentW_Q.clone().invert()).normalize();
}

export function swingTwistDecompose(q: THREE.Quaternion, axisV: THREE.Vector3) {
  const r = new THREE.Vector3(q.x, q.y, q.z);
  const p = axisV.clone().multiplyScalar(r.dot(axisV));
  const twist = new THREE.Quaternion(p.x, p.y, p.z, q.w).normalize();
  const swing = q.clone().multiply(twist.clone().invert()).normalize();
  return { swing, twist };
}

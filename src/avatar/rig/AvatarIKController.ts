import * as THREE from 'three';
import { CCDIKSolver } from 'three/examples/jsm/animation/CCDIKSolver.js';

export class AvatarIKController {
  solver: CCDIKSolver;
  mesh: THREE.SkinnedMesh;
  targets: Record<string, THREE.Bone> = {};
  basePositions: Record<string, THREE.Vector3> = {};

  constructor(mesh: THREE.SkinnedMesh, iks: any[]) {
    this.mesh = mesh;
    this.solver = new CCDIKSolver(mesh, iks);
    
    const skeleton = mesh.skeleton;
    iks.forEach(ik => {
      const targetBone = skeleton.bones[ik.target];
      this.targets[targetBone.name] = targetBone;
      this.basePositions[targetBone.name] = targetBone.position.clone();
    });
  }

  update() {
    this.solver.update();
  }

  setTargetPosition(name: string, position: THREE.Vector3) {
    if (this.targets[name]) {
      this.targets[name].position.copy(position);
    }
  }

  reset() {
    Object.keys(this.targets).forEach(name => {
      this.targets[name].position.copy(this.basePositions[name]);
    });
    this.solver.update();
  }
}

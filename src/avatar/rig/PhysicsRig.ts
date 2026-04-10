import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export class PhysicsRig {
  world: RAPIER.World | null = null;
  boneBodies: { bone: THREE.Bone, body: RAPIER.RigidBody }[] = [];
  initialTransforms = new Map<THREE.Bone, { pos: THREE.Vector3, rot: THREE.Quaternion }>();
  
  async init() {
    await RAPIER.init();
    // Use a stronger gravity for a snappy, 2D cutout feel
    this.world = new RAPIER.World({ x: 0, y: -20.0, z: 0 });
  }

  build(skeleton: THREE.Skeleton, getTerrainHeight?: (x: number, z: number) => number) {
    if (!this.world) return;
    
    // Recreate the world to ensure a completely clean state and avoid Rust borrow panics
    this.world.free();
    this.world = new RAPIER.World({ x: 0, y: -20.0, z: 0 });
    
    this.boneBodies = [];
    this.initialTransforms.clear();
    
    const boneMap = new Map<THREE.Bone, RAPIER.RigidBody>();

    // Ensure matrices are up to date before reading world positions
    skeleton.bones[0].updateMatrixWorld(true);

    // Create Terrain Collider if provided
    if (getTerrainHeight) {
      const nrows = 50;
      const ncols = 50;
      const heights = new Float32Array(nrows * ncols);
      const scale = 200;
      
      for (let i = 0; i < nrows; i++) {
        for (let j = 0; j < ncols; j++) {
          // Map grid indices to world coordinates (-100 to 100)
          const x = (j / (ncols - 1) - 0.5) * scale;
          const z = (i / (nrows - 1) - 0.5) * scale;
          // Rapier heightfields are column-major
          heights[j * nrows + i] = getTerrainHeight(x, z);
        }
      }
      
      const terrainDesc = RAPIER.ColliderDesc.heightfield(
        nrows, ncols, heights, { x: scale, y: 1.0, z: scale }
      );
      this.world.createCollider(terrainDesc);
    }

    // 1. Create Rigid Bodies
    skeleton.bones.forEach(bone => {
      // Store initial local transform for resetting later
      this.initialTransforms.set(bone, { 
        pos: bone.position.clone(), 
        rot: bone.quaternion.clone() 
      });

      const worldPos = new THREE.Vector3();
      bone.getWorldPosition(worldPos);

      // Make the pelvis kinematic so it holds the avatar up, everything else is dynamic
      const isRoot = bone.name === 'pelvis';
      const bodyDesc = isRoot 
        ? RAPIER.RigidBodyDesc.kinematicPositionBased() 
        : RAPIER.RigidBodyDesc.dynamic();
      
      bodyDesc.setTranslation(worldPos.x, worldPos.y, worldPos.z);
      
      // Add damping to simulate air resistance and prevent infinite swinging
      bodyDesc.setLinearDamping(2.0);
      bodyDesc.setAngularDamping(2.0);

      const body = this.world!.createRigidBody(bodyDesc);
      
      // Allow full 3D physics: do not lock translations or rotations
      // body.lockTranslations(false, false, true, true);
      // body.lockRotations(true, true, false, true);
      
      // Add a small spherical collider to give the bone mass
      const colliderDesc = RAPIER.ColliderDesc.ball(0.5).setMass(1.0);
      this.world!.createCollider(colliderDesc, body);

      boneMap.set(bone, body);
      this.boneBodies.push({ bone, body });
    });

    // 2. Create Joints
    skeleton.bones.forEach(bone => {
      if (bone.parent && bone.parent.type === 'Bone') {
        const parentBody = boneMap.get(bone.parent as THREE.Bone);
        const childBody = boneMap.get(bone);
        
        if (parentBody && childBody) {
          // The child's local position relative to the parent is exactly the anchor point
          const anchorParent = { x: bone.position.x, y: bone.position.y, z: bone.position.z };
          const anchorChild = { x: 0, y: 0, z: 0 };
          
          // Use a spherical joint. Since rotations are locked to the Z axis, this acts like a 2D hinge.
          const params = RAPIER.JointData.spherical(anchorParent, anchorChild);
          this.world!.createImpulseJoint(params, parentBody, childBody, true);
        }
      }
    });
  }

  update(time: number) {
    if (!this.world || this.boneBodies.length === 0) return;
    
    // Procedurally drive the kinematic root (pelvis) to show off the ragdoll physics
    const root = this.boneBodies.find(b => b.bone.name === 'pelvis');
    if (root) {
       const init = this.initialTransforms.get(root.bone);
       if (init) {
         // Calculate world position of the root based on its initial local position
         const parentWorldMatrix = root.bone.parent ? root.bone.parent.matrixWorld.clone() : new THREE.Matrix4();
         const baseWorldPos = new THREE.Vector3().copy(init.pos).applyMatrix4(parentWorldMatrix);
         
         // Apply a 3D figure-8 motion
         const x = baseWorldPos.x + Math.sin(time * 2) * 3;
         const y = baseWorldPos.y + Math.sin(time * 4) * 1.5;
         const z = baseWorldPos.z + Math.cos(time * 2) * 4;
         
         root.body.setNextKinematicTranslation({ x, y, z });
       }
    }

    // Step the physics simulation
    this.world.step();
    
    // Sync physics bodies back to Three.js bones
    for (const { bone, body } of this.boneBodies) {
      const pos = body.translation();
      const rot = body.rotation();
      
      const worldMatrix = new THREE.Matrix4().compose(
        new THREE.Vector3(pos.x, pos.y, pos.z),
        new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w),
        new THREE.Vector3(1, 1, 1)
      );

      // Convert world matrix to local matrix
      const parentWorldMatrix = bone.parent ? bone.parent.matrixWorld.clone() : new THREE.Matrix4();
      const localMatrix = parentWorldMatrix.invert().multiply(worldMatrix);
      
      localMatrix.decompose(bone.position, bone.quaternion, bone.scale);
      bone.updateMatrixWorld(true);
    }
  }

  resetSkeleton(skeleton: THREE.Skeleton) {
    skeleton.bones.forEach(bone => {
      const init = this.initialTransforms.get(bone);
      if (init) {
        bone.position.copy(init.pos);
        bone.quaternion.copy(init.rot);
      }
      bone.updateMatrixWorld(true);
    });
  }

  dispose() {
     if (this.world) {
        this.world.free();
        this.world = null;
     }
  }
}

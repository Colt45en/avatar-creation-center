import * as THREE from 'three';
import { AvatarIKController } from './AvatarIKController';

export class ProceduralWalkController {
  ik: AvatarIKController;
  skeleton: THREE.Skeleton;
  getTerrainHeight: (x: number, z: number) => number;
  
  speed = 8.0;
  stepLength = 4.0;
  stepHeight = 1.5;
  stepDuration = 0.3;
  
  pelvisBaseY: number;
  
  legs: {
    ikTargetName: string;
    isStepping: boolean;
    stepProgress: number;
    startPos: THREE.Vector3;
    targetPos: THREE.Vector3;
    currentPos: THREE.Vector3;
    restOffset: THREE.Vector3;
  }[] = [];

  constructor(ik: AvatarIKController, skeleton: THREE.Skeleton, getTerrainHeight: (x: number, z: number) => number) {
    this.ik = ik;
    this.skeleton = skeleton;
    this.getTerrainHeight = getTerrainHeight;
    
    const pelvis = this.skeleton.bones.find(b => b.name === 'pelvis');
    this.pelvisBaseY = pelvis ? pelvis.position.y : 10;

    // Initialize legs based on their IK base positions
    ['lFootIK', 'rFootIK'].forEach(ikName => {
      const basePos = this.ik.basePositions[ikName];
      if (basePos) {
        this.legs.push({
          ikTargetName: ikName,
          isStepping: false,
          stepProgress: 0,
          startPos: basePos.clone(),
          targetPos: basePos.clone(),
          currentPos: basePos.clone(),
          restOffset: basePos.clone() // Offset from origin (assuming pelvis starts near x=0, z=0)
        });
      }
    });
  }

  update(delta: number, time: number) {
    const pelvis = this.skeleton.bones.find(b => b.name === 'pelvis');
    if (!pelvis) return;

    // Move pelvis forward
    pelvis.position.z += this.speed * delta;
    
    // Sample terrain height at pelvis position
    const terrainY = this.getTerrainHeight(pelvis.position.x, pelvis.position.z);
    
    // Add some procedural bobbing to the pelvis
    const bobbing = Math.sin(time * this.speed * 1.5) * 0.5;
    pelvis.position.y = this.pelvisBaseY + terrainY + bobbing;

    // Update legs
    this.legs.forEach((leg, index) => {
      const otherLeg = this.legs[(index + 1) % this.legs.length];
      
      // Calculate ideal resting position for this foot
      const idealPos = new THREE.Vector3(
        pelvis.position.x + leg.restOffset.x,
        0,
        pelvis.position.z + leg.restOffset.z
      );
      idealPos.y = this.getTerrainHeight(idealPos.x, idealPos.z);

      if (!leg.isStepping) {
        // Check if we need to step
        const distanceToIdeal = leg.currentPos.distanceTo(idealPos);
        
        // Only step if the other leg is NOT stepping (to prevent jumping)
        // and we are far enough from the ideal position
        if (distanceToIdeal > this.stepLength * 0.5 && !otherLeg.isStepping) {
          leg.isStepping = true;
          leg.stepProgress = 0;
          leg.startPos.copy(leg.currentPos);
          
          // Predict where the ideal position will be at the end of the step
          leg.targetPos.copy(idealPos);
          leg.targetPos.z += this.speed * this.stepDuration; // lead the target
          leg.targetPos.y = this.getTerrainHeight(leg.targetPos.x, leg.targetPos.z);
        }
      }

      if (leg.isStepping) {
        leg.stepProgress += delta / this.stepDuration;
        
        if (leg.stepProgress >= 1.0) {
          leg.stepProgress = 1.0;
          leg.isStepping = false;
        }

        // Interpolate position
        const t = leg.stepProgress;
        // Ease in-out
        const easeT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        
        leg.currentPos.lerpVectors(leg.startPos, leg.targetPos, easeT);
        
        // Add parabolic arc for step height
        const arc = Math.sin(t * Math.PI) * this.stepHeight;
        leg.currentPos.y += arc;
      } else {
        // Keep foot planted on the ground
        leg.currentPos.y = this.getTerrainHeight(leg.currentPos.x, leg.currentPos.z);
      }

      // Apply to IK
      this.ik.setTargetPosition(leg.ikTargetName, leg.currentPos);
    });

    // Procedural arm swing (opposite to legs)
    const lHandIK = this.ik.basePositions['lHandIK'];
    const rHandIK = this.ik.basePositions['rHandIK'];
    
    if (lHandIK && rHandIK) {
      // Base arm swing on the opposite leg's position relative to pelvis
      const rLegOffsetZ = this.legs[1].currentPos.z - pelvis.position.z;
      const lLegOffsetZ = this.legs[0].currentPos.z - pelvis.position.z;
      
      this.ik.setTargetPosition('lHandIK', new THREE.Vector3(
        pelvis.position.x + lHandIK.x,
        pelvis.position.y + lHandIK.y - this.pelvisBaseY,
        pelvis.position.z + rLegOffsetZ * 0.8 // Left arm swings with right leg
      ));
      
      this.ik.setTargetPosition('rHandIK', new THREE.Vector3(
        pelvis.position.x + rHandIK.x,
        pelvis.position.y + rHandIK.y - this.pelvisBaseY,
        pelvis.position.z + lLegOffsetZ * 0.8 // Right arm swings with left leg
      ));
    }

    this.ik.update();
  }

  reset() {
    const pelvis = this.skeleton.bones.find(b => b.name === 'pelvis');
    if (pelvis) {
      pelvis.position.set(0, this.pelvisBaseY, 0);
    }
    this.legs.forEach(leg => {
      leg.isStepping = false;
      leg.currentPos.copy(leg.restOffset);
      this.ik.setTargetPosition(leg.ikTargetName, leg.restOffset);
    });
    this.ik.reset();
  }
}

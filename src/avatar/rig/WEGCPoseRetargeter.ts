import * as THREE from 'three';
import { resolveBoneByAliases } from './BoneResolver';
import { buildBasis_YForward, worldDirToParentLocalDir, swingTwistDecompose } from './KinematicsMath';

export interface JointDef {
    boneName: string;
    A: string;
    B: string;
    C: string;
    slerp?: number;
    preRotQ?: THREE.Quaternion;
    hinge?: {
        axis: 'x' | 'y' | 'z';
        killTwist: boolean;
        minDeg?: number;
        maxDeg?: number;
    };
    bone?: THREE.Bone | null;
}

export class WEGCPoseRetargeter {
    skeleton: THREE.Skeleton;
    jointDefs: JointDef[];
    calib: Map<string, { restOffsetQ: THREE.Quaternion, boneRestLocalQ: THREE.Quaternion }>;
    lockedBones: Set<string>;
    calibrated: boolean;
    requestCalib: boolean;
    root: { bone: THREE.Bone | null, restOffsetQ: THREE.Quaternion, boneRestLocalQ: THREE.Quaternion, ready: boolean };

    constructor(skeleton: THREE.Skeleton, jointDefs: JointDef[]) {
        this.skeleton = skeleton;
        this.jointDefs = jointDefs.map(jd => {
            const bone = resolveBoneByAliases(skeleton, jd.boneName) || (skeleton.getBoneByName ? skeleton.getBoneByName(jd.boneName) : null);
            return { ...jd, bone };
        });
        this.calib = new Map();
        this.lockedBones = new Set();
        this.calibrated = false;
        this.requestCalib = false;
        const hipsBone = resolveBoneByAliases(skeleton, 'Hips');
        this.root = { bone: hipsBone, restOffsetQ: new THREE.Quaternion(), boneRestLocalQ: new THREE.Quaternion(), ready: false };
    }

    triggerCalibration() { this.requestCalib = true; }
    setLock(uuid: string, isLocked: boolean) { if (isLocked) this.lockedBones.add(uuid); else this.lockedBones.delete(uuid); }

    calibrate(poseWorld: Record<string, THREE.Vector3>) {
        if (!poseWorld) return;
        for (const jd of this.jointDefs) {
            const bone = jd.bone;
            if (!bone || !bone.parent) continue;
            const parentWorldQ = new THREE.Quaternion();
            bone.parent.getWorldQuaternion(parentWorldQ);
            const measuredLocalQ = this.computeMeasuredLocalQ(jd, poseWorld, parentWorldQ);
            if (!measuredLocalQ) continue;
            const boneRestLocalQ = bone.quaternion.clone();
            const restOffsetQ = measuredLocalQ.clone().invert().multiply(boneRestLocalQ).normalize();
            this.calib.set(bone.uuid, { restOffsetQ, boneRestLocalQ });
        }
        this.calibrated = true;
        this.requestCalib = false;
        console.log('Calibration complete.');
    }

    update(poseWorld: any[]) {
        if (!poseWorld || !poseWorld.length) return;
        const L_idx: Record<string, number> = {
            nose: 0, left_ear: 7, right_ear: 8, left_shoulder: 11, right_shoulder: 12, left_elbow: 13, right_elbow: 14,
            left_wrist: 15, right_wrist: 16, left_index: 19, right_index: 20, left_pinky: 17, right_pinky: 18,
            left_hip: 23, right_hip: 24, left_knee: 25, right_knee: 26, left_ankle: 27, right_ankle: 28, left_foot_index: 31, right_foot_index: 32, left_heel: 29, right_heel: 30
        };
        const namedPose: Record<string, THREE.Vector3> = {};
        for(const [name, idx] of Object.entries(L_idx)) {
            if(poseWorld[idx]) namedPose[name] = new THREE.Vector3(poseWorld[idx].x, poseWorld[idx].y, -poseWorld[idx].z); // Invert Z
        }

        if (!this.calibrated || this.requestCalib) { this.calibrate(namedPose); return; }
        
        this.updateRoot(namedPose);
        for (const jd of this.jointDefs) {
            const bone = jd.bone;
            if (!bone || !bone.parent) continue;
            const bc = this.calib.get(bone.uuid);
            if (!bc) continue;
            if (this.lockedBones.has(bone.uuid)) continue;
            const parentWorldQ = new THREE.Quaternion();
            bone.parent.getWorldQuaternion(parentWorldQ);
            const measuredLocalQ = this.computeMeasuredLocalQ(jd, namedPose, parentWorldQ);
            if (!measuredLocalQ) continue;
            
            let targetLocalQ = measuredLocalQ.multiply(bc.restOffsetQ).normalize();
            if (jd.preRotQ) targetLocalQ.multiply(jd.preRotQ).normalize();
            if (jd.hinge) targetLocalQ = this.applyHinge(targetLocalQ, jd.hinge);
            bone.quaternion.slerp(targetLocalQ, jd.slerp ?? 0.35);
        }
    }

    updateRoot(poseWorld: Record<string, THREE.Vector3>) {
        const hips = this.root.bone;
        if (!hips || !hips.parent) return;
        const lh = poseWorld.left_hip, rh = poseWorld.right_hip;
        const ls = poseWorld.left_shoulder, rs = poseWorld.right_shoulder;
        if (!lh || !rh || !ls || !rs) return;
        const hipC = lh.clone().add(rh).multiplyScalar(0.5);
        const shC = ls.clone().add(rs).multiplyScalar(0.5);
        const upW = shC.clone().sub(hipC);
        const acrossW = rh.clone().sub(lh);
        if (upW.lengthSq() < 1e-10 || acrossW.lengthSq() < 1e-10) return;
        
        const parentWorldQ = new THREE.Quaternion();
        hips.parent.getWorldQuaternion(parentWorldQ);
        const upL = worldDirToParentLocalDir(upW, parentWorldQ);
        const acrossL = worldDirToParentLocalDir(acrossW, parentWorldQ);
        const { x, y, z } = buildBasis_YForward(upL, acrossL);
        const m = new THREE.Matrix4().makeBasis(x, y, z);
        const measuredLocalQ = new THREE.Quaternion().setFromRotationMatrix(m).normalize();
        
        if (!this.root.ready) {
            this.root.boneRestLocalQ = hips.quaternion.clone();
            this.root.restOffsetQ.copy(measuredLocalQ.clone().invert().multiply(this.root.boneRestLocalQ).normalize());
            this.root.ready = true;
            return;
        }
        if (this.lockedBones.has(hips.uuid)) return;
        const targetLocalQ = measuredLocalQ.multiply(this.root.restOffsetQ).normalize();
        hips.quaternion.slerp(targetLocalQ, 0.35);
    }

    computeMeasuredLocalQ(jd: JointDef, poseWorld: Record<string, THREE.Vector3>, parentWorldQ: THREE.Quaternion) {
        const A = poseWorld[jd.A], B = poseWorld[jd.B], C = poseWorld[jd.C];
        if (!A || !B || !C) return null;
        const forwardW = new THREE.Vector3().subVectors(B, A);
        const sideRefW = new THREE.Vector3().subVectors(C, A);
        if (forwardW.lengthSq() < 1e-8 || sideRefW.lengthSq() < 1e-8) return null;
        
        const forwardL = worldDirToParentLocalDir(forwardW, parentWorldQ);
        const sideRefL = worldDirToParentLocalDir(sideRefW, parentWorldQ);
        const { x, y, z } = buildBasis_YForward(forwardL, sideRefL);
        const m = new THREE.Matrix4().makeBasis(x, y, z);
        return new THREE.Quaternion().setFromRotationMatrix(m).normalize();
    }

    applyHinge(q: THREE.Quaternion, hinge: { axis: 'x' | 'y' | 'z', killTwist: boolean, minDeg?: number, maxDeg?: number }) {
        const axis = hinge.axis === 'x' ? new THREE.Vector3(1, 0, 0) :
                     hinge.axis === 'y' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
        const { swing, twist } = swingTwistDecompose(q, axis);
        let out = hinge.killTwist ? swing : q;
        if (hinge.minDeg != null && hinge.maxDeg != null) {
            const e = new THREE.Euler().setFromQuaternion(out, 'XYZ');
            if (hinge.axis === 'x') { e.y=0; e.z=0; e.x = THREE.MathUtils.clamp(e.x, hinge.minDeg*Math.PI/180, hinge.maxDeg*Math.PI/180); }
            else if (hinge.axis === 'y') { e.x=0; e.z=0; e.y = THREE.MathUtils.clamp(e.y, hinge.minDeg*Math.PI/180, hinge.maxDeg*Math.PI/180); }
            else { e.x=0; e.y=0; e.z = THREE.MathUtils.clamp(e.z, hinge.minDeg*Math.PI/180, hinge.maxDeg*Math.PI/180); }
            out = new THREE.Quaternion().setFromEuler(e);
        }
        return out.normalize();
    }
}

export const WEGC_JOINT_DEFS: JointDef[] = [
    { boneName: 'Spine2', A: 'left_hip', B: 'left_shoulder', C: 'right_shoulder', slerp: 0.16 },
    { boneName: 'NeckAnchor', A: 'left_shoulder', B: 'nose', C: 'right_shoulder' },
    { boneName: 'Shoulder_L', A: 'left_shoulder', B: 'left_elbow', C: 'right_shoulder' },
    { boneName: 'Elbow_L', A: 'left_elbow', B: 'left_wrist', C: 'left_shoulder', hinge: { axis: 'y', killTwist: true, minDeg: -5, maxDeg: 150 } },
    { boneName: 'Wrist_L', A: 'left_wrist', B: 'left_index', C: 'left_pinky' },
    { boneName: 'Shoulder_R', A: 'right_shoulder', B: 'right_elbow', C: 'left_shoulder' },
    { boneName: 'Elbow_R', A: 'right_elbow', B: 'right_wrist', C: 'right_shoulder', hinge: { axis: 'y', killTwist: true, minDeg: -5, maxDeg: 150 } },
    { boneName: 'Wrist_R', A: 'right_wrist', B: 'right_index', C: 'right_pinky' },
    { boneName: 'Hip_L', A: 'left_hip', B: 'left_knee', C: 'right_hip' },
    { boneName: 'Knee_L', A: 'left_knee', B: 'left_ankle', C: 'left_hip', hinge: { axis: 'x', killTwist: true, minDeg: 0, maxDeg: 160 } },
    { boneName: 'Ankle_L', A: 'left_ankle', B: 'left_foot_index', C: 'left_heel' },
    { boneName: 'Hip_R', A: 'right_hip', B: 'right_knee', C: 'left_hip' },
    { boneName: 'Knee_R', A: 'right_knee', B: 'right_ankle', C: 'right_hip', hinge: { axis: 'x', killTwist: true, minDeg: 0, maxDeg: 160 } },
    { boneName: 'Ankle_R', A: 'right_ankle', B: 'right_foot_index', C: 'right_heel' },
];

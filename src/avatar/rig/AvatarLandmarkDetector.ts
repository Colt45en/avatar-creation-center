import { AvatarLandmarks, Point2D } from '../contracts/avatarTypes';
import * as poseDetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';

export class AvatarLandmarkDetector {
  private static detector: poseDetection.PoseDetector | null = null;

  static async initDetector() {
    if (!this.detector) {
      const model = poseDetection.SupportedModels.MoveNet;
      const detectorConfig = {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
      };
      this.detector = await poseDetection.createDetector(model, detectorConfig);
    }
    return this.detector;
  }

  /**
   * Phase 1: Landmark detection based on MoveNet with a fallback to heuristic bounding box.
   */
  static async detect(baseCanvas: HTMLCanvasElement, threshold: number): Promise<AvatarLandmarks> {
    try {
      const detector = await this.initDetector();
      const poses = await detector.estimatePoses(baseCanvas);

      if (poses.length > 0 && poses[0].keypoints) {
        const keypoints = poses[0].keypoints;
        
        const getPoint = (name: string): Point2D | null => {
          const kp = keypoints.find(k => k.name === name);
          if (kp && kp.score && kp.score > 0.1) {
            return { x: kp.x, y: kp.y };
          }
          return null;
        };

        const nose = getPoint('nose');
        const leftShoulder = getPoint('left_shoulder');
        const rightShoulder = getPoint('right_shoulder');
        const leftElbow = getPoint('left_elbow');
        const rightElbow = getPoint('right_elbow');
        const leftWrist = getPoint('left_wrist');
        const rightWrist = getPoint('right_wrist');
        const leftHip = getPoint('left_hip');
        const rightHip = getPoint('right_hip');
        const leftKnee = getPoint('left_knee');
        const rightKnee = getPoint('right_knee');
        const leftAnkle = getPoint('left_ankle');
        const rightAnkle = getPoint('right_ankle');

        const fallback = this.fallbackDetect(baseCanvas, threshold);

        const head = nose || fallback.head;
        
        let neck: Point2D;
        if (leftShoulder && rightShoulder) {
          neck = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 };
        } else {
          neck = fallback.neck;
        }

        let pelvis: Point2D;
        if (leftHip && rightHip) {
          pelvis = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };
        } else {
          pelvis = fallback.pelvis;
        }

        let chest: Point2D;
        if (neck && pelvis) {
          chest = { x: (neck.x + pelvis.x) / 2, y: (neck.y + pelvis.y) / 2 };
        } else {
          chest = fallback.chest;
        }

        return {
          head,
          neck,
          chest,
          pelvis,
          leftShoulder: leftShoulder || fallback.leftShoulder,
          rightShoulder: rightShoulder || fallback.rightShoulder,
          leftElbow: leftElbow || fallback.leftElbow,
          rightElbow: rightElbow || fallback.rightElbow,
          leftHand: leftWrist || fallback.leftHand,
          rightHand: rightWrist || fallback.rightHand,
          leftKnee: leftKnee || fallback.leftKnee,
          rightKnee: rightKnee || fallback.rightKnee,
          leftFoot: leftAnkle || fallback.leftFoot,
          rightFoot: rightAnkle || fallback.rightFoot,
        };
      }
    } catch (e) {
      console.warn("Pose detection failed, falling back to heuristic", e);
    }

    // Fallback if no pose detected or error occurs
    return this.fallbackDetect(baseCanvas, threshold);
  }

  static fallbackDetect(baseCanvas: HTMLCanvasElement, threshold: number): AvatarLandmarks {
    const ctx = baseCanvas.getContext('2d');
    const width = baseCanvas.width;
    const height = baseCanvas.height;
    
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let found = false;

    if (ctx) {
      const imgData = ctx.getImageData(0, 0, width, height).data;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r = imgData[idx], g = imgData[idx+1], b = imgData[idx+2];
          
          if (r >= threshold || g >= threshold || b >= threshold) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            found = true;
          }
        }
      }
    }

    if (!found) {
      minX = width * 0.25; maxX = width * 0.75;
      minY = height * 0.1; maxY = height * 0.9;
    }

    const boxW = maxX - minX;
    const boxH = maxY - minY;
    const centerX = minX + boxW / 2;

    return {
      head: { x: centerX, y: minY + boxH * 0.08 },
      neck: { x: centerX, y: minY + boxH * 0.18 },
      chest: { x: centerX, y: minY + boxH * 0.28 },
      pelvis: { x: centerX, y: minY + boxH * 0.50 },
      
      leftShoulder: { x: centerX - boxW * 0.22, y: minY + boxH * 0.20 },
      rightShoulder: { x: centerX + boxW * 0.22, y: minY + boxH * 0.20 },
      
      leftElbow: { x: centerX - boxW * 0.35, y: minY + boxH * 0.38 },
      rightElbow: { x: centerX + boxW * 0.35, y: minY + boxH * 0.38 },
      
      leftHand: { x: centerX - boxW * 0.45, y: minY + boxH * 0.55 },
      rightHand: { x: centerX + boxW * 0.45, y: minY + boxH * 0.55 },
      
      leftKnee: { x: centerX - boxW * 0.15, y: minY + boxH * 0.72 },
      rightKnee: { x: centerX + boxW * 0.15, y: minY + boxH * 0.72 },
      
      leftFoot: { x: centerX - boxW * 0.18, y: maxY - boxH * 0.05 },
      rightFoot: { x: centerX + boxW * 0.18, y: maxY - boxH * 0.05 },
    };
  }
}

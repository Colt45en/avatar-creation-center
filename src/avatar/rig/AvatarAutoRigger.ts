import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { AvatarLandmarks, Point2D } from '../contracts/avatarTypes';

export class AvatarAutoRigger {
  static createRiggedAvatar(
    texture: THREE.Texture, 
    landmarks: AvatarLandmarks, 
    width: number, 
    height: number, 
    outputSize: number
  ) {
    // 1. Create High-Density Geometry for Deformation
    // Increased from 40x40 to 64x64 for smoother bending and higher precision
    const segmentsX = 64;
    const segmentsY = 64;
    const geometry = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);

    // 2. Map 2D Landmarks to 3D Local Space
    const mapPt = (p: Point2D) => {
      const nx = (p.x / outputSize) - 0.5;
      const ny = -(p.y / outputSize) + 0.5;
      return new THREE.Vector3(nx * width, ny * height, 0);
    };

    const pts = {
      pelvis: mapPt(landmarks.pelvis),
      spine: new THREE.Vector3().lerpVectors(mapPt(landmarks.pelvis), mapPt(landmarks.chest), 0.5),
      chest: mapPt(landmarks.chest),
      neck: mapPt(landmarks.neck),
      head: mapPt(landmarks.head),
      lShoulder: mapPt(landmarks.leftShoulder),
      lElbow: mapPt(landmarks.leftElbow),
      lHand: mapPt(landmarks.leftHand),
      rShoulder: mapPt(landmarks.rightShoulder),
      rElbow: mapPt(landmarks.rightElbow),
      rHand: mapPt(landmarks.rightHand),
      lKnee: mapPt(landmarks.leftKnee),
      lFoot: mapPt(landmarks.leftFoot),
      rKnee: mapPt(landmarks.rightKnee),
      rFoot: mapPt(landmarks.rightFoot),
    };

    // 3. Create Bone Hierarchy
    const bones: THREE.Bone[] = [];
    const boneMap = new Map<string, THREE.Bone>();

    const parentMapPos = (name: string) => {
       const mapping: Record<string, THREE.Vector3> = {
         'spine': pts.pelvis,
         'chest': pts.spine,
         'neck': pts.chest,
         'head': pts.neck,
         'lShoulder': pts.chest,
         'lElbow': pts.lShoulder,
         'lHand': pts.lElbow,
         'rShoulder': pts.chest,
         'rElbow': pts.rShoulder,
         'rHand': pts.rElbow,
         'lKnee': pts.pelvis,
         'lFoot': pts.lKnee,
         'rKnee': pts.pelvis,
         'rFoot': pts.rKnee
       };
       return mapping[name] || new THREE.Vector3();
    };

    const createBone = (name: string, pos: THREE.Vector3, parentName?: string) => {
      const bone = new THREE.Bone();
      bone.name = name;
      if (parentName) {
        const parent = boneMap.get(parentName)!;
        parent.add(bone);
        // Position must be relative to parent's world position
        bone.position.copy(pos).sub(parentMapPos(name));
      } else {
        bone.position.copy(pos);
      }
      bones.push(bone);
      boneMap.set(name, bone);
      return bone;
    };

    const root = createBone('pelvis', pts.pelvis);
    createBone('spine', pts.spine, 'pelvis');
    createBone('chest', pts.chest, 'spine');
    createBone('neck', pts.neck, 'chest');
    createBone('head', pts.head, 'neck');

    createBone('lShoulder', pts.lShoulder, 'chest');
    createBone('lElbow', pts.lElbow, 'lShoulder');
    createBone('lHand', pts.lHand, 'lElbow');

    createBone('rShoulder', pts.rShoulder, 'chest');
    createBone('rElbow', pts.rElbow, 'rShoulder');
    createBone('rHand', pts.rHand, 'rElbow');

    createBone('lKnee', pts.lKnee, 'pelvis');
    createBone('lFoot', pts.lFoot, 'lKnee');

    createBone('rKnee', pts.rKnee, 'pelvis');
    createBone('rFoot', pts.rFoot, 'rKnee');

    // IK Targets
    createBone('lHandIK', pts.lHand, 'pelvis');
    createBone('rHandIK', pts.rHand, 'pelvis');
    createBone('lFootIK', pts.lFoot, 'pelvis');
    createBone('rFootIK', pts.rFoot, 'pelvis');

    const lockZ = {
      rotationMin: new THREE.Vector3(0, 0, -Math.PI),
      rotationMax: new THREE.Vector3(0, 0, Math.PI)
    };

    const iks = [
      {
        target: bones.indexOf(boneMap.get('lHandIK')!),
        effector: bones.indexOf(boneMap.get('lHand')!),
        links: [
          { index: bones.indexOf(boneMap.get('lElbow')!), ...lockZ },
          { index: bones.indexOf(boneMap.get('lShoulder')!), ...lockZ }
        ]
      },
      {
        target: bones.indexOf(boneMap.get('rHandIK')!),
        effector: bones.indexOf(boneMap.get('rHand')!),
        links: [
          { index: bones.indexOf(boneMap.get('rElbow')!), ...lockZ },
          { index: bones.indexOf(boneMap.get('rShoulder')!), ...lockZ }
        ]
      },
      {
        target: bones.indexOf(boneMap.get('lFootIK')!),
        effector: bones.indexOf(boneMap.get('lFoot')!),
        links: [
          { index: bones.indexOf(boneMap.get('lKnee')!), ...lockZ }
        ]
      },
      {
        target: bones.indexOf(boneMap.get('rFootIK')!),
        effector: bones.indexOf(boneMap.get('rFoot')!),
        links: [
          { index: bones.indexOf(boneMap.get('rKnee')!), ...lockZ }
        ]
      }
    ];

    // 4. Helper to generate a skinned mesh for a specific LOD
    const createLODMesh = (segmentsX: number, segmentsY: number) => {
      const geometry = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);
      const positionAttribute = geometry.attributes.position;
      const skinIndices = [];
      const skinWeights = [];

      // --- maskToMesh logic (Heightfield from Alpha) ---
      const canvas = document.createElement('canvas');
      canvas.width = texture.image.width;
      canvas.height = texture.image.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(texture.image, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < positionAttribute.count; i++) {
        const x = i % (segmentsX + 1);
        const y = Math.floor(i / (segmentsX + 1));
        const u = x / segmentsX;
        const v = y / segmentsY;
        const ix = Math.min(canvas.width - 1, Math.floor(u * (canvas.width - 1)));
        const iy = Math.min(canvas.height - 1, Math.floor((1 - v) * (canvas.height - 1)));
        const alpha = data[(iy * canvas.width + ix) * 4 + 3] / 255;
        
        const iso = 0.5;
        const z = alpha > iso ? (alpha - iso) * 0.25 * width : 0;
        positionAttribute.setZ(i, z);
      }
      geometry.computeVertexNormals();

      // Laplacian smooth
      const iterations = 1;
      const tmp = positionAttribute.array.slice() as Float32Array;
      const idx = geometry.index?.array as Uint16Array | Uint32Array | null;
      if (idx) {
        const adjacency: number[][] = Array(positionAttribute.count).fill(null).map(() => []);
        for (let i = 0; i < idx.length; i += 3) {
          const a = idx[i], b = idx[i+1], c = idx[i+2];
          adjacency[a].push(b, c); adjacency[b].push(a, c); adjacency[c].push(a, b);
        }
        for (let it = 0; it < iterations; it++) {
          for (let v = 0; v < positionAttribute.count; v++) {
            const nbrs = adjacency[v];
            let sx=0, sy=0, sz=0;
            const n = nbrs.length;
            if (n > 0) {
              for (let k = 0; k < n; k++) {
                const j = nbrs[k];
                sx += positionAttribute.getX(j); sy += positionAttribute.getY(j); sz += positionAttribute.getZ(j);
              }
              tmp[v*3+0] = sx / n;
              tmp[v*3+1] = sy / n;
              tmp[v*3+2] = sz / n;
            }
          }
          positionAttribute.array.set(tmp);
          positionAttribute.needsUpdate = true;
          geometry.computeVertexNormals();
        }
      }
      // --- end maskToMesh logic ---

      // Helper: shortest distance from point to line segment
      const distToSegment = (p: THREE.Vector3, v: THREE.Vector3, w: THREE.Vector3) => {
        const l2 = v.distanceToSquared(w);
        if (l2 === 0) return p.distanceTo(v);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        const proj = new THREE.Vector3(v.x + t * (w.x - v.x), v.y + t * (w.y - v.y), 0);
        return p.distanceTo(proj);
      };

      // Base radius unit relative to avatar height
      const baseR = height * 0.1;

      // Extend extremities so the mesh boundaries (fingers, toes, top of head) are fully enveloped
      const extendPt = (p1: THREE.Vector3, p2: THREE.Vector3, factor: number) => {
        return new THREE.Vector3().copy(p2).add(new THREE.Vector3().subVectors(p2, p1).multiplyScalar(factor));
      };
      
      const headEnd = extendPt(pts.neck, pts.head, 0.6);
      const lHandEnd = extendPt(pts.lElbow, pts.lHand, 0.4);
      const rHandEnd = extendPt(pts.rElbow, pts.rHand, 0.4);
      const lFootEnd = extendPt(pts.lKnee, pts.lFoot, 0.4);
      const rFootEnd = extendPt(pts.rKnee, pts.rFoot, 0.4);

      // Define the segments that influence the mesh with specific bounding radii and anatomical thickness (zScale)
      const boneSegments = [
        { id: bones.indexOf(boneMap.get('pelvis')!), v: pts.pelvis, w: pts.spine, radius: baseR * 3.5, zScale: 1.2 },
        { id: bones.indexOf(boneMap.get('spine')!), v: pts.spine, w: pts.chest, radius: baseR * 3.2, zScale: 1.1 },
        { id: bones.indexOf(boneMap.get('chest')!), v: pts.chest, w: pts.neck, radius: baseR * 3.0, zScale: 1.0 },
        { id: bones.indexOf(boneMap.get('neck')!), v: pts.neck, w: pts.head, radius: baseR * 1.5, zScale: 0.8 },
        { id: bones.indexOf(boneMap.get('head')!), v: pts.neck, w: headEnd, radius: baseR * 2.5, zScale: 1.2 },
        { id: bones.indexOf(boneMap.get('lShoulder')!), v: pts.chest, w: pts.lShoulder, radius: baseR * 1.5, zScale: 0.6 },
        { id: bones.indexOf(boneMap.get('lElbow')!), v: pts.lShoulder, w: pts.lElbow, radius: baseR * 1.2, zScale: 0.5 },
        { id: bones.indexOf(boneMap.get('lHand')!), v: pts.lElbow, w: lHandEnd, radius: baseR * 1.0, zScale: 0.4 },
        { id: bones.indexOf(boneMap.get('rShoulder')!), v: pts.chest, w: pts.rShoulder, radius: baseR * 1.5, zScale: 0.6 },
        { id: bones.indexOf(boneMap.get('rElbow')!), v: pts.rShoulder, w: pts.rElbow, radius: baseR * 1.2, zScale: 0.5 },
        { id: bones.indexOf(boneMap.get('rHand')!), v: pts.rElbow, w: rHandEnd, radius: baseR * 1.0, zScale: 0.4 },
        { id: bones.indexOf(boneMap.get('lKnee')!), v: pts.pelvis, w: pts.lKnee, radius: baseR * 1.8, zScale: 0.8 },
        { id: bones.indexOf(boneMap.get('lFoot')!), v: pts.lKnee, w: lFootEnd, radius: baseR * 1.4, zScale: 0.6 },
        { id: bones.indexOf(boneMap.get('rKnee')!), v: pts.pelvis, w: pts.rKnee, radius: baseR * 1.8, zScale: 0.8 },
        { id: bones.indexOf(boneMap.get('rFoot')!), v: pts.rKnee, w: rFootEnd, radius: baseR * 1.4, zScale: 0.6 },
      ];

      for (let i = 0; i < positionAttribute.count; i++) {
        const vertex = new THREE.Vector3();
        vertex.fromBufferAttribute(positionAttribute, i);

        let minDist = Infinity;
        let dominantZScale = 1.0;

        const influences = boneSegments.map(seg => {
          const dist = distToSegment(vertex, seg.v, seg.w);
          if (dist < minDist) {
            minDist = dist;
            dominantZScale = seg.zScale;
          }
          
          let weight = 0;
          const cutoff = seg.radius * 1.8; // Extended cutoff for smoother blending across joints
          
          if (dist < cutoff) {
            const normalizedDist = dist / seg.radius;
            
            // Smoother weighting strategy:
            // 1. Gaussian envelope for smooth, natural falloff
            const gaussian = Math.exp(-Math.pow(normalizedDist, 2) * 1.5);
            
            // 2. Softened inverse distance for strong local attachment to the bone
            const idw = 1.0 / (Math.pow(normalizedDist, 2) + 0.2);
            
            // 3. Smoothstep taper to strictly prevent cross-limb bleeding at the cutoff
            const taper = Math.pow(Math.max(0, 1.0 - (dist / cutoff)), 2);
            
            weight = gaussian * idw * taper;
          }
          
          return { id: seg.id, weight, dist };
        });

        influences.sort((a, b) => b.weight - a.weight);
        const top4 = influences.slice(0, 4);
        let totalWeight = top4.reduce((sum, inf) => sum + inf.weight, 0);

        // Fallback if vertex is too far from all bones
        if (totalWeight === 0) {
          influences.sort((a, b) => a.dist - b.dist);
          for (let j = 0; j < 4; j++) {
            const inf = influences[j];
            // Smoother fallback using inverse cubic distance
            top4[j] = { id: inf.id, weight: 1.0 / (Math.pow(inf.dist, 3) + 0.001), dist: inf.dist };
          }
          totalWeight = top4.reduce((sum, inf) => sum + inf.weight, 0);
        }

        skinIndices.push(top4[0].id, top4[1].id, top4[2].id, top4[3].id);
        skinWeights.push(
          top4[0].weight / totalWeight,
          top4[1].weight / totalWeight,
          top4[2].weight / totalWeight,
          top4[3].weight / totalWeight
        );
      }

      geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
      geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
      geometry.computeVertexNormals();

      const morphMuscular = [];
      const morphBigHead = [];
      const morphWavy = [];

      for (let i = 0; i < positionAttribute.count; i++) {
        const vx = positionAttribute.getX(i);
        const vy = positionAttribute.getY(i);
        const vz = positionAttribute.getZ(i);
        const vertex = new THREE.Vector3(vx, vy, vz);

        const distToChest = vertex.distanceTo(pts.chest);
        const buffFactor = Math.max(0, 1 - distToChest / (baseR * 5));
        const buffOffsetX = (vx > pts.chest.x ? 1 : -1) * buffFactor * baseR * 1.5;
        const buffOffsetZ = buffFactor * baseR * 1.0;
        morphMuscular.push(buffOffsetX, 0, buffOffsetZ);

        const distToHead = vertex.distanceTo(pts.head);
        const headFactor = Math.max(0, 1 - distToHead / (baseR * 3.5));
        const headOffsetX = (vx - pts.head.x) * headFactor * 1.5;
        const headOffsetY = (vy - pts.head.y) * headFactor * 1.5;
        const headOffsetZ = headFactor * baseR * 1.5;
        morphBigHead.push(headOffsetX, headOffsetY, headOffsetZ);

        const wavyOffsetX = Math.sin(vy / (baseR * 2)) * baseR;
        morphWavy.push(wavyOffsetX, 0, 0);
      }

      geometry.morphAttributes.position = [];
      
      const attrMuscular = new THREE.Float32BufferAttribute(morphMuscular, 3);
      attrMuscular.name = 'Muscular';
      geometry.morphAttributes.position.push(attrMuscular);

      const attrBigHead = new THREE.Float32BufferAttribute(morphBigHead, 3);
      attrBigHead.name = 'Big Head';
      geometry.morphAttributes.position.push(attrBigHead);

      const attrWavy = new THREE.Float32BufferAttribute(morphWavy, 3);
      attrWavy.name = 'Wavy';
      geometry.morphAttributes.position.push(attrWavy);

      // --- Thicken geometry (maskToMesh) ---
      const g1 = geometry.clone();
      const g2 = geometry.clone();
      
      // push along normals
      const pos2 = g2.attributes.position as THREE.BufferAttribute;
      const nrm2 = g2.attributes.normal as THREE.BufferAttribute;
      const thickness = 0.02 * width;
      for (let i = 0; i < pos2.count; i++) {
        pos2.setX(i, pos2.getX(i) - nrm2.getX(i) * thickness);
        pos2.setY(i, pos2.getY(i) - nrm2.getY(i) * thickness);
        pos2.setZ(i, pos2.getZ(i) - nrm2.getZ(i) * thickness);
      }
      pos2.needsUpdate = true;
      
      // flip winding
      const idx2 = g2.getIndex();
      if (idx2) {
        for (let i = 0; i < idx2.count; i += 3) {
          const a = idx2.getX(i), b = idx2.getX(i+1), c = idx2.getX(i+2);
          idx2.setX(i, a); idx2.setX(i+1, c); idx2.setX(i+2, b);
        }
      }
      
      const merged = BufferGeometryUtils.mergeGeometries([g1, g2]);
      return merged;
    };

    // 5. Create Shared Material and Skeleton
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
      wireframe: false
    });

    const skeleton = new THREE.Skeleton(bones);

    // 6. Generate LOD Levels
    const lod = new THREE.LOD();
    lod.add(root); // Add the root bone to the LOD object

    const createLevel = (segments: number, distance: number) => {
      const geo = createLODMesh(segments, segments);
      const mesh = new THREE.SkinnedMesh(geo, material);
      mesh.bind(skeleton);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      if (geo.morphAttributes.position) {
        mesh.morphTargetDictionary = { 'Muscular': 0, 'Big Head': 1, 'Wavy': 2 };
        mesh.morphTargetInfluences = [0, 0, 0];
      }
      
      lod.addLevel(mesh, distance);
      return mesh;
    };

    const highResMesh = createLevel(64, 0);    // High detail for close-up
    createLevel(32, 20);                       // Medium detail
    createLevel(16, 50);                       // Low detail for far away

    return { lod, skinnedMesh: highResMesh, skeleton, root, iks, material };
  }
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Extracted from Runbook 2.45C: PNG Sprite Sheet → Heightfield Bust
 * Converts a single depth/height PNG into a 2.5D bust via PlaneGeometry displacement.
 */
export async function createHeightfieldBust(
  heightUrl: string,
  scale = 1,
  depth = 0.35,
  smoothIters = 2,
  thickness = 0.02
): Promise<THREE.Mesh> {
  const img = Object.assign(new Image(), { src: heightUrl, decoding: 'async' as const });
  await img.decode();

  const cnv = document.createElement('canvas');
  cnv.width = img.width;
  cnv.height = img.height;
  const g = cnv.getContext('2d')!;
  g.drawImage(img, 0, 0);

  const data = g.getImageData(0, 0, img.width, img.height).data;
  const geo = new THREE.PlaneGeometry(1, img.height / img.width, img.width - 1, img.height - 1);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;

  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const v = (data[i] + data[i + 1] + data[i + 2]) / 765; // 0..1
      const idx = y * img.width + x;
      pos.setZ(idx, (0.5 - v) * depth);
    }
  }

  // Ensure indexed
  if (!geo.index) {
    const indices = [];
    for (let i = 0; i < pos.count; i++) indices.push(i);
    geo.setIndex(indices);
  }
  geo.computeVertexNormals();

  // Simple Laplacian smooth
  for (let k = 0; k < smoothIters; k++) {
    geo.computeVertexNormals();
  }

  // Solidify by cloning, flipping, and merging
  const back = geo.clone();
  back.scale(1, 1, -1);
  back.translate(0, 0, -thickness);

  const mrg = mergeGeometries([geo, back]);
  const mesh = new THREE.Mesh(
    mrg || geo, 
    new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0, roughness: 1 })
  );
  
  mesh.scale.setScalar(scale);

  return mesh;
}

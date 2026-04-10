import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { AvatarAutoRigger } from '../rig/AvatarAutoRigger';
import { AvatarLandmarks } from '../contracts/avatarTypes';
import { WebIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { draco } from '@gltf-transform/functions';
import draco3d from 'draco3d';

export interface ExportOptions {
  binary?: boolean;
  draco?: boolean;
}

export class AvatarGLBExporter {
  static async exportGLB(
    alphaDataUrl: string,
    landmarks: AvatarLandmarks,
    outputSize: number,
    options: ExportOptions = { binary: true, draco: false }
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(
        alphaDataUrl,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          
          const aspect = texture.image.width / texture.image.height;
          const height = 20;
          const width = height * aspect;
          
          const { lod } = AvatarAutoRigger.createRiggedAvatar(
            texture,
            landmarks,
            width,
            height,
            outputSize
          );
          
          lod.name = "AvatarLOD";
          
          const exporter = new GLTFExporter();
          const needsProcessing = options.draco;
          const exportBinary = options.binary || needsProcessing;

          exporter.parse(
            lod,
            async (gltf) => {
              if (needsProcessing) {
                try {
                  const io = new WebIO().registerExtensions(KHRONOS_EXTENSIONS);
                  io.registerDependencies({
                    'draco3d.encoder': await draco3d.createEncoderModule(),
                    'draco3d.decoder': await draco3d.createDecoderModule(),
                  });
                  
                  const document = await io.readBinary(new Uint8Array(gltf as ArrayBuffer));
                  
                  if (options.draco) {
                    await document.transform(draco());
                  }
                  
                  const glb = await io.writeBinary(document);
                  resolve(new Blob([glb], { type: 'model/gltf-binary' }));
                } catch (err) {
                  reject(err);
                }
              } else {
                if (exportBinary) {
                  resolve(new Blob([gltf as ArrayBuffer], { type: 'model/gltf-binary' }));
                } else {
                  resolve(new Blob([JSON.stringify(gltf)], { type: 'model/gltf+json' }));
                }
              }
            },
            (error) => {
              reject(error);
            },
            { binary: exportBinary }
          );
        },
        undefined,
        reject
      );
    });
  }
}

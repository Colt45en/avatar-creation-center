import * as THREE from 'three'
import { GLTFExporter } from 'three-stdlib'
import { useDeck } from '../pipeline/deck'
import { WebIO } from '@gltf-transform/core'
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions'
import { draco } from '@gltf-transform/functions'
import draco3d from 'draco3d'

export interface ExportOptions {
  binary?: boolean;
  draco?: boolean;
}

export function exportGLB(options: ExportOptions = { binary: true, draco: false }) {
  const { focusedId, avatars } = useDeck.getState()
  const item = avatars.find(a => a.id === focusedId)
  if (!item) return
  
  const exporter = new GLTFExporter()
  const needsProcessing = options.draco;
  const exportBinary = options.binary || needsProcessing;

  exporter.parse(
    item.mesh, 
    async (gltf) => {
      let finalBlob: Blob;
      let extension = exportBinary ? 'glb' : 'gltf';

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
          finalBlob = new Blob([glb], { type: 'model/gltf-binary' });
          extension = 'glb'; // Force GLB when using Draco for simplicity
        } catch (err) {
          console.error("Error during gltf-transform processing:", err);
          alert("Draco compression failed. Check console for details. (Note: draco3d may require specific WASM bundler setup in Vite).");
          return;
        }
      } else {
        if (exportBinary) {
          finalBlob = new Blob([gltf as ArrayBuffer], { type: 'model/gltf-binary' });
        } else {
          finalBlob = new Blob([JSON.stringify(gltf)], { type: 'model/gltf+json' });
        }
      }

      const a = document.createElement('a')
      a.href = URL.createObjectURL(finalBlob)
      a.download = (item.name?.replace(/\.[a-z]+$/i, '') || 'avatar') + '.' + extension;
      a.click()
    }, 
    (err) => {
      console.error("Error exporting GLTF:", err);
    }, 
    { binary: exportBinary }
  )
}

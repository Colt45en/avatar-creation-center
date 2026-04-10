import JSZip from 'jszip';
import { AvatarPipelineController } from '../controller/AvatarPipelineController';
import { AvatarSettings } from '../contracts/avatarTypes';

/**
 * Extracted from Runbook 2.45D & 2.12: Normalize + ZIP Batch
 * Processes a batch of front/side mask pairs, normalizes them, and exports a ZIP with a manifest.
 */
export async function processBatchZip(
  fronts: File[],
  settings: AvatarSettings,
  zipName = 'avatars_batch.zip'
) {
  const zip = new JSZip();
  const manifest: any[] = [];

  for (const file of fronts) {
    try {
      // 1. Run the standard pipeline (Mesh -> Normalize -> Rig -> GLB)
      const processed = await AvatarPipelineController.process(file, settings);
      
      // 2. Add GLB to ZIP
      if (processed.assets.model) {
        const res = await fetch(processed.assets.model);
        const buf = await res.arrayBuffer();
        
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        const filename = `${baseName}.glb`;
        
        zip.file(filename, buf);
        
        manifest.push({ 
          name: filename, 
          size: buf.byteLength, 
          original: file.name,
          landmarks: processed.landmarks
        });
      }
    } catch (err) {
      console.error(`Failed to process ${file.name}`, err);
    }
  }

  // 3. Add Manifest
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  
  // 4. Generate and Download ZIP
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = zipName;
  a.click();
  
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

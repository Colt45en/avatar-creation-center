import JSZip from 'jszip';
import { loadImage } from '../utils/imageIO';
import { AvatarPreprocessor } from '../preprocess/AvatarPreprocessor';
import { AvatarAssetDeriver } from '../derive/AvatarAssetDeriver';
import { AvatarManifestBuilder } from '../manifest/AvatarManifestBuilder';
import { AvatarLandmarkDetector } from '../rig/AvatarLandmarkDetector';
import { AvatarGLBExporter } from '../derive/AvatarGLBExporter';
import { AvatarSettings, ProcessedAvatar } from '../contracts/avatarTypes';

export class AvatarPipelineController {
  static async process(file: File, settings: AvatarSettings): Promise<ProcessedAvatar> {
    const img = await loadImage(file);
    
    // 1. Preprocess
    const baseCanvas = AvatarPreprocessor.process(img, settings);
    
    // 2. Derive Assets
    const assets = AvatarAssetDeriver.deriveAssets(baseCanvas, settings);
    
    // 3. Detect Landmarks (Phase 1)
    const landmarks = await AvatarLandmarkDetector.detect(baseCanvas, settings.threshold);

    // 4. Build Manifest
    const manifest = AvatarManifestBuilder.build(settings, file, landmarks);

    // 5. Generate GLB (Phase 2 Auto-Rigging Export)
    const glbBlob = await AvatarGLBExporter.exportGLB(assets.alpha, landmarks, settings.outputSize);
    
    // Convert Blob to Base64 so it can be safely stored in IndexedDB
    const glbBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(glbBlob);
    });

    const finalAssets = { ...assets, model: glbBase64 };

    return { manifest, assets: finalAssets, landmarks };
  }

  static async exportBundle(processed: ProcessedAvatar): Promise<Blob> {
    const zip = new JSZip();
    
    // Helper to convert data URL to Blob
    const dataUrlToBlob = async (dataUrl: string) => {
      const res = await fetch(dataUrl);
      return await res.blob();
    };

    zip.file("manifest.json", JSON.stringify(processed.manifest, null, 2));
    zip.file(processed.manifest.outputs.landmarks!, JSON.stringify(processed.landmarks, null, 2));
    zip.file(processed.manifest.outputs.base, await dataUrlToBlob(processed.assets.base));
    zip.file(processed.manifest.outputs.alpha!, await dataUrlToBlob(processed.assets.alpha));
    zip.file(processed.manifest.outputs.mask!, await dataUrlToBlob(processed.assets.mask));
    zip.file(processed.manifest.outputs.thumb256!, await dataUrlToBlob(processed.assets.thumb256));
    zip.file(processed.manifest.outputs.thumb64!, await dataUrlToBlob(processed.assets.thumb64));
    
    if (processed.assets.model && processed.manifest.outputs.model) {
      zip.file(processed.manifest.outputs.model, await dataUrlToBlob(processed.assets.model));
    }

    return await zip.generateAsync({ type: "blob" });
  }
}

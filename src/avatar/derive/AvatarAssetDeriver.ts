import { cloneCanvas, resizeCanvas } from '../utils/imageIO';
import { applyBlackToAlpha, applyBinaryMask } from '../utils/pixelOps';
import { AvatarSettings } from '../contracts/avatarTypes';

export class AvatarAssetDeriver {
  static deriveAssets(baseCanvas: HTMLCanvasElement, settings: AvatarSettings) {
    // 1. Base (White on Black) - already what baseCanvas is
    const baseDataUrl = baseCanvas.toDataURL('image/png');

    // 2. White on Alpha
    const alphaCanvas = cloneCanvas(baseCanvas);
    const alphaCtx = alphaCanvas.getContext('2d');
    if (alphaCtx) applyBlackToAlpha(alphaCtx, alphaCanvas.width, alphaCanvas.height, settings.threshold);
    const alphaDataUrl = alphaCanvas.toDataURL('image/png');

    // 3. Binary Mask
    const maskCanvas = cloneCanvas(baseCanvas);
    const maskCtx = maskCanvas.getContext('2d');
    if (maskCtx) applyBinaryMask(maskCtx, maskCanvas.width, maskCanvas.height, settings.threshold);
    const maskDataUrl = maskCanvas.toDataURL('image/png');

    // 4. Thumbnails (from Alpha canvas for transparency)
    const thumb256Canvas = resizeCanvas(alphaCanvas, 256, 256);
    const thumb256DataUrl = thumb256Canvas.toDataURL('image/png');

    const thumb64Canvas = resizeCanvas(alphaCanvas, 64, 64);
    const thumb64DataUrl = thumb64Canvas.toDataURL('image/png');

    return {
      base: baseDataUrl,
      alpha: alphaDataUrl,
      mask: maskDataUrl,
      thumb256: thumb256DataUrl,
      thumb64: thumb64DataUrl
    };
  }
}

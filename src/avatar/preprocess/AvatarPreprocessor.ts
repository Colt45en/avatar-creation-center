import { AvatarSettings } from '../contracts/avatarTypes';

export class AvatarPreprocessor {
  static process(img: HTMLImageElement, settings: AvatarSettings): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const size = settings.outputSize;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Fill black background first
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);

    // Calculate centering and scaling
    let x = 0, y = 0, w = size, h = size;
    
    if (settings.centered) {
      const scale = Math.min(size / img.width, size / img.height);
      w = img.width * scale;
      h = img.height * scale;
      x = (size - w) / 2;
      y = (size - h) / 2;
    }

    ctx.drawImage(img, x, y, w, h);
    return canvas;
  }
}

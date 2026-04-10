export function applyBlackToAlpha(ctx: CanvasRenderingContext2D, width: number, height: number, threshold: number = 10) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i+1], b = d[i+2];
    const isBlack = r < threshold && g < threshold && b < threshold;
    if (isBlack) {
      d[i+3] = 0; // fully transparent
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

export function applyBinaryMask(ctx: CanvasRenderingContext2D, width: number, height: number, threshold: number = 10) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i+1], b = d[i+2];
    const isBlack = r < threshold && g < threshold && b < threshold;
    if (isBlack) {
      d[i] = 0; d[i+1] = 0; d[i+2] = 0; d[i+3] = 255;
    } else {
      d[i] = 255; d[i+1] = 255; d[i+2] = 255; d[i+3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

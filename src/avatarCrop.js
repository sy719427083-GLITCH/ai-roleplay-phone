export function getAvatarCropDraw({
  imageWidth,
  imageHeight,
  outputSize = 200,
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
}) {
  const safeWidth = Math.max(1, Number(imageWidth) || 1);
  const safeHeight = Math.max(1, Number(imageHeight) || 1);
  const safeOutput = Math.max(1, Number(outputSize) || 1);
  const safeZoom = Math.max(1, Number(zoom) || 1);
  const baseScale = Math.max(safeOutput / safeWidth, safeOutput / safeHeight);
  const dWidth = Math.round(safeWidth * baseScale * safeZoom);
  const dHeight = Math.round(safeHeight * baseScale * safeZoom);
  const dx = Math.round((safeOutput - dWidth) / 2 + Number(offsetX || 0));
  const dy = Math.round((safeOutput - dHeight) / 2 + Number(offsetY || 0));

  return { dx, dy, dWidth, dHeight };
}

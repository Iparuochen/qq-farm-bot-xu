// Spine atlas `rotate: true` stores a region counter-clockwise in the page.
// Restore its upright orientation before applying attachment-local UVs.
function drawAtlasRegion(ctx, source, r) {
  if (r.rotate) {
    ctx.translate(r.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(source, r.x, r.y, r.height, r.width, 0, 0, r.height, r.width);
  } else {
    ctx.drawImage(source, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
  }
}
module.exports = { drawAtlasRegion };

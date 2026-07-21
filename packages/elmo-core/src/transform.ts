// 2D affine transforms for component orientation (rotate 0/90/180/270 + mirror).
// Geometry is drawn in a local frame and mapped to the world with one matrix, so
// a rotated resistor is the same drawing under a different transform.

export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}
interface Pt {
  x: number;
  y: number;
}

export const apply = (m: Affine, p: Pt): Pt => ({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f });
/** Apply the linear part only (for direction vectors — no translation). */
export const applyDir = (m: Affine, v: Pt): Pt => ({ x: m.a * v.x + m.c * v.y, y: m.b * v.x + m.d * v.y });

const r2 = (x: number): number => Math.round(x * 1000) / 1000;
export const matrixStr = (m: Affine): string => `matrix(${r2(m.a)} ${r2(m.b)} ${r2(m.c)} ${r2(m.d)} ${r2(m.e)} ${r2(m.f)})`;

/** m ∘ o — apply o first, then m. */
function mul(m: Affine, o: Affine): Affine {
  return {
    a: m.a * o.a + m.c * o.b,
    b: m.b * o.a + m.d * o.b,
    c: m.a * o.c + m.c * o.d,
    d: m.b * o.c + m.d * o.d,
    e: m.a * o.e + m.c * o.f + m.e,
    f: m.b * o.e + m.d * o.f + m.f,
  };
}

export const translate = (m: Affine, tx: number, ty: number): Affine => ({ ...m, e: m.e + tx, f: m.f + ty });

/**
 * Build the local→oriented-frame transform for a w×h box: optional horizontal
 * mirror, then rotation, then shift so the bounding box starts at (0,0).
 * Returns the matrix and the oriented bounding-box size.
 */
export function orient(rotation: number, mirror: boolean, w: number, h: number): { T: Affine; W: number; H: number } {
  const rad = ((((rotation % 360) + 360) % 360) * Math.PI) / 180;
  const cos = Math.round(Math.cos(rad));
  const sin = Math.round(Math.sin(rad));
  const mir: Affine = mirror ? { a: -1, b: 0, c: 0, d: 1, e: w, f: 0 } : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const rot: Affine = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
  let m = mul(rot, mir);
  const corners = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ].map((p) => apply(m, p));
  const minX = Math.min(...corners.map((c) => c.x));
  const minY = Math.min(...corners.map((c) => c.y));
  const maxX = Math.max(...corners.map((c) => c.x));
  const maxY = Math.max(...corners.map((c) => c.y));
  m = translate(m, -minX, -minY);
  return { T: m, W: maxX - minX, H: maxY - minY };
}

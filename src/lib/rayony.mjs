// Район Новосибирска по координатам: точка в многоугольнике границ из OpenStreetMap (src/data/rayony.json).
import data from '../data/rayony.json' with { type: 'json' };

export const OUTSIDE = 'За чертой города';
export const RAYONY = data['районы'].map((r) => r.name);

function inRing([x, y], ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[j];
    const [x2, y2] = ring[i];
    if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) c = !c;
  }
  return c;
}

/** @param {[number, number]} lonlat – [долгота, широта] как в съёме Яндекса */
export function rayon(lonlat) {
  if (!lonlat || lonlat.length !== 2) return OUTSIDE;
  const r = data['районы'].find((d) => d.rings.some((ring) => inRing(lonlat, ring)));
  return r ? r.name : OUTSIDE;
}

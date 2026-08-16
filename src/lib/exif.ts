/**
 * Minimal JPEG EXIF GPS reader (no dependency).
 * Returns null when the file carries no GPS block — callers must treat that as
 * EXIF_UNAVAILABLE, never as a rejection.
 */
export type ExifGps = { lat: number; lng: number };

export async function readExifGps(file: Blob): Promise<ExifGps | null> {
  try {
    const buf = await file.arrayBuffer();
    const view = new DataView(buf);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // not JPEG

    let offset = 2;
    while (offset + 4 < view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      const size = view.getUint16(offset + 2);
      if (marker === 0xe1) {
        const app1 = offset + 4;
        if (view.getUint32(app1) !== 0x45786966) return null; // "Exif"
        return parseTiff(view, app1 + 6);
      }
      offset += 2 + size;
    }
    return null;
  } catch {
    return null;
  }
}

function parseTiff(view: DataView, tiff: number): ExifGps | null {
  const le = view.getUint16(tiff) === 0x4949;
  const u16 = (o: number) => view.getUint16(o, le);
  const u32 = (o: number) => view.getUint32(o, le);
  if (u16(tiff + 2) !== 0x002a) return null;

  const ifd0 = tiff + u32(tiff + 4);
  const count = u16(ifd0);
  let gpsIfd = 0;
  for (let i = 0; i < count; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (u16(entry) === 0x8825) gpsIfd = tiff + u32(entry + 8);
  }
  if (!gpsIfd) return null;

  const gpsCount = u16(gpsIfd);
  let lat: number | null = null;
  let lng: number | null = null;
  let latRef = "N";
  let lngRef = "E";

  for (let i = 0; i < gpsCount; i++) {
    const entry = gpsIfd + 2 + i * 12;
    const tag = u16(entry);
    const type = u16(entry + 2);
    const num = u32(entry + 4);
    const valueOffset = num * (type === 5 ? 8 : 1) > 4 ? tiff + u32(entry + 8) : entry + 8;

    if (tag === 0x0001 || tag === 0x0003) {
      const ref = String.fromCharCode(view.getUint8(entry + 8));
      if (tag === 0x0001) latRef = ref;
      else lngRef = ref;
    }
    if ((tag === 0x0002 || tag === 0x0004) && type === 5 && num === 3) {
      const rat = (o: number) => {
        const n = u32(o);
        const d = u32(o + 4);
        return d ? n / d : 0;
      };
      const deg = rat(valueOffset) + rat(valueOffset + 8) / 60 + rat(valueOffset + 16) / 3600;
      if (tag === 0x0002) lat = deg;
      else lng = deg;
    }
  }

  if (lat == null || lng == null) return null;
  if (latRef === "S") lat = -lat;
  if (lngRef === "W") lng = -lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

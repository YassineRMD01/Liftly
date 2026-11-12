/** Browser-side helpers for gym logos: resizing uploads and finding their brand colors. */

/** Read an image file and return it as a PNG/WebP data URL no larger than `max`×`max` px (keeps storage small). */
export function resizeImage(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unreadable image'));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width || max, img.height || max));
        const w = Math.max(1, Math.round((img.width || max) * scale));
        const h = Math.max(1, Math.round((img.height || max) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        // WebP keeps transparency and is small; fall back to PNG where unsupported
        const webp = canvas.toDataURL('image/webp', 0.9);
        resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png'));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** HSL saturation & lightness of an RGB color (0–1). */
function satLight(r: number, g: number, b: number) {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

/**
 * The most prominent brand colors of a logo, strongest first.
 * Transparent, near-white, near-black and grey pixels are ignored; colors are
 * grouped coarsely and ranked by how much of the logo they cover × how vivid they are.
 */
export function extractLogoColors(dataUrl: string, count = 4): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve([]);
    img.onload = () => {
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      const buckets = new Map<string, { r: number; g: number; b: number; n: number; s: number }>();
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
        if (a < 128) continue;
        const { s, l } = satLight(r, g, b);
        if (l > 0.86 || l < 0.08 || s < 0.25) continue;
        const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
        const bk = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0, s: 0 };
        bk.r += r; bk.g += g; bk.b += b; bk.n++; bk.s += s;
        buckets.set(key, bk);
      }
      const ranked = [...buckets.values()]
        .map((bk) => ({ hex: toHex(bk.r / bk.n, bk.g / bk.n, bk.b / bk.n), rgb: [bk.r / bk.n, bk.g / bk.n, bk.b / bk.n], score: bk.n * (bk.s / bk.n) }))
        .sort((a, b) => b.score - a.score);
      // keep colors that are clearly different from the ones already picked
      const picked: typeof ranked = [];
      for (const c of ranked) {
        if (picked.every((p) => Math.hypot(p.rgb[0] - c.rgb[0], p.rgb[1] - c.rgb[1], p.rgb[2] - c.rgb[2]) > 60)) picked.push(c);
        if (picked.length === count) break;
      }
      resolve(picked.map((c) => c.hex));
    };
    img.src = dataUrl;
  });
}

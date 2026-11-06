"use client";

import { useEffect, useState } from "react";
import { linkClass } from "@/components/ui";

/** The QR's square inside the image, as fractions of the image's width. */
type Crop = { left: number; top: number; size: number };

/** Large images are read at this width at most: plenty for a QR, and quick on a phone. */
const MAX_READ_WIDTH = 1200;
/** Blank squares a scanner needs around a QR. */
const QUIET_MODULES = 4;

async function findQr(src: string): Promise<Crop | null> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = src;
  await image.decode();

  const scale = Math.min(1, MAX_READ_WIDTH / image.naturalWidth);
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, width, height);

  const { default: jsQR } = await import("jsqr");
  const found = jsQR(context.getImageData(0, 0, width, height).data, width, height);
  if (!found) return null;

  const { topLeftCorner: a, topRightCorner: b, bottomLeftCorner: c, bottomRightCorner: d } = found.location;
  const xs = [a.x, b.x, c.x, d.x];
  const ys = [a.y, b.y, c.y, d.y];
  const side = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const quiet = (side / (17 + 4 * found.version)) * QUIET_MODULES;
  const size = side + quiet * 2;
  // Keep the square inside the image. The quiet zone is white anyway, so a tight edge can't hurt the scan.
  const left = Math.max(0, Math.min(width - size, Math.min(...xs) - quiet));
  const top = Math.max(0, Math.min(height - size, Math.min(...ys) - quiet));
  return { left: left / width, top: top / width, size: size / width };
}

/**
 * The store's payment QR, zoomed to the code itself. Uploaded QRs are usually a screenshot with wide margins
 * and text, which leaves the code too small to scan. If the code can't be found, the whole image is shown.
 */
export function GcashQr({ src }: { src: string }) {
  const [crop, setCrop] = useState<Crop | null>(null);

  useEffect(() => {
    let stale = false;
    findQr(src)
      .then((found) => {
        if (!stale) setCrop(found);
      })
      .catch(() => {
        // Whole image stays on screen.
      });
    return () => {
      stale = true;
    };
  }, [src]);

  const extension = src.match(/\.\w+$/)?.[0] ?? ".png";

  return (
    <>
      <div className="relative aspect-square w-full max-w-sm overflow-clip rounded-lg border border-ink-200 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="GCash QR code"
          className={crop ? "absolute max-w-none" : "absolute inset-0 h-full w-full object-contain"}
          style={
            crop
              ? {
                  width: `${100 / crop.size}%`,
                  left: `${(-crop.left / crop.size) * 100}%`,
                  top: `${(-crop.top / crop.size) * 100}%`,
                }
              : undefined
          }
        />
      </div>
      <a href={`${src}?download=gcash-qr${extension}`} className={`${linkClass} inline-flex min-h-11 items-center text-sm`}>
        Save QR to your phone
      </a>
    </>
  );
}

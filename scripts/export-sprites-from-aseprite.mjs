/**
 * Export cat animation strips from assets/source/Cat_Grey.aseprite
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Aseprite from "ase-parser";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const sourcePath = join(root, "assets", "source", "Cat_Grey.aseprite");
const outDir = join(root, "public", "cat");

const MANIFEST = {
  frameWidth: 32,
  frameHeight: 32,
  scale: 3.5,
  anchor: "bottom",
  drawOffsetY: 0,
  feetLiftPx: 0,
  /** Filled from alpha scan after export — tight box around all frames */
  canvasPadTop: 2,
  canvasPadBottom: 5,
  canvasPadLeft: 2,
  canvasPadRight: 2,
  /** Per-animation drawOffsetY removed — all clips align to sit paw line. */
  animations: {
    sit: { tag: "Sit_1", file: "sit.png", fps: 5, loop: true },
    nap: { tag: "Dream", file: "nap.png", fps: 5, loop: true },
    walk: { tag: "W_1", file: "walk.png", fps: 9, loop: true },
    stretch: { tag: "Idle_3", file: "stretch.png", fps: 7, loop: false },
    look_tilt: { tag: "Idle_Tilt_1", file: "look_tilt.png", fps: 7, loop: false },
    look_lift: { tag: "Idle_Lift_1", file: "look_lift.png", fps: 7, loop: false },
    sit_tilt: { tag: "Sit_Tilt_1", file: "sit_tilt.png", fps: 7, loop: false },
    happy: { tag: "Idle_Yes", file: "happy.png", fps: 8, loop: false },
    scratch: { tag: "Scratching_Start", file: "scratch.png", fps: 8, loop: false },
    alert: { tag: "Idle_2", file: "alert.png", fps: 7, loop: false },
    hold: { tag: "Sit_Lift_1", file: "hold.png", fps: 8, loop: true },
    carry: { tag: "Jump_1", file: "carry.png", fps: 10, loop: true },
    run: { tag: "Run_1", file: "run.png", fps: 12, loop: true },
    angry: { tag: "Aggress", file: "angry.png", fps: 10, loop: false },
  },
};

function sortCels(cels) {
  return [...cels].sort((a, b) => {
    const orderA = a.layerIndex + a.zIndex;
    const orderB = b.layerIndex + b.zIndex;
    return orderA - orderB || a.zIndex - b.zIndex;
  });
}

async function renderFrame(ase, frameIndex) {
  const frame = ase.frames[frameIndex];
  if (!frame?.cels?.length) {
    throw new Error(`Frame ${frameIndex} has no cels`);
  }

  const cels = sortCels(frame.cels).filter((cel) => cel.rawCelData?.length);
  const composites = [];

  for (const cel of cels) {
    const input = await sharp(cel.rawCelData, {
      raw: { width: cel.w, height: cel.h, channels: 4 },
    })
      .png()
      .toBuffer();

    composites.push({ input, left: cel.xpos, top: cel.ypos });
  }

  return sharp({
    create: {
      width: ase.width,
      height: ase.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

function tagFrameRange(ase, tagName) {
  const tag = ase.tags?.find((t) => t.name === tagName);
  if (!tag) {
    const names = ase.tags?.map((t) => t.name).join(", ") ?? "";
    throw new Error(`Tag "${tagName}" not found. Available: ${names}`);
  }
  const frames = [];
  for (let i = tag.from; i <= tag.to; i++) {
    frames.push(i);
  }
  return frames;
}

async function exportStrip(ase, frameIndices) {
  const frames = await Promise.all(
    frameIndices.map((index) => renderFrame(ase, index)),
  );

  const fw = ase.width;
  const fh = ase.height;
  const strip = await sharp({
    create: {
      width: fw * frames.length,
      height: fh,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(
      frames.map((buf, i) => ({
        input: buf,
        left: i * fw,
        top: 0,
      })),
    )
    .png()
    .toBuffer();

  return { strip, frameCount: frames.length };
}

const ALPHA_HIT = 40;
const BOUNDS_MARGIN = 1;

/** Union opaque bounds across every exported frame (source pixels). */
async function measureGlobalContentBounds(frameWidth, frameHeight) {
  const { readdirSync } = await import("node:fs");
  let minX = frameWidth;
  let minY = frameHeight;
  let maxX = 0;
  let maxY = 0;

  for (const file of readdirSync(outDir).filter((f) => f.endsWith(".png"))) {
    const path = join(outDir, file);
    const meta = await sharp(path).metadata();
    const frameCount = Math.floor(meta.width / frameWidth);

    for (let i = 0; i < frameCount; i++) {
      const { data, info } = await sharp(path)
        .extract({
          left: i * frameWidth,
          top: 0,
          width: frameWidth,
          height: frameHeight,
        })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const channels = info.channels;
      for (let y = 0; y < frameHeight; y++) {
        for (let x = 0; x < frameWidth; x++) {
          const a =
            channels === 4 ? data[(y * frameWidth + x) * 4 + 3] : 255;
          if (a > ALPHA_HIT) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }
    }
  }

  if (maxX < minX) {
    throw new Error("No opaque pixels found in exported sprites");
  }

  return { left: minX, top: minY, right: maxX, bottom: maxY };
}

async function main() {
  const buffer = readFileSync(sourcePath);
  const ase = new Aseprite(buffer, "Cat_Grey.aseprite");
  ase.parse();

  mkdirSync(outDir, { recursive: true });

  const animations = {};

  for (const [key, def] of Object.entries(MANIFEST.animations)) {
    const indices = tagFrameRange(ase, def.tag);
    const { strip, frameCount } = await exportStrip(ase, indices);
    const outPath = join(outDir, def.file);
    writeFileSync(outPath, strip);
    console.log(`Wrote ${def.file} (${frameCount} frames, tag ${def.tag})`);

    animations[key] = {
      file: def.file,
      frameCount,
      fps: def.fps,
      loop: def.loop,
    };
  }

  const fw = MANIFEST.frameWidth;
  const fh = MANIFEST.frameHeight;
  const bounds = await measureGlobalContentBounds(fw, fh);
  const m = BOUNDS_MARGIN;

  const contentBounds = {
    left: bounds.left,
    top: bounds.top,
    right: bounds.right,
    // Include a little extra below measured paws (walk frames dip lower).
    bottom: Math.min(fh - 1, bounds.bottom + 2),
  };

  const canvasPadLeft = Math.max(0, bounds.left - m);
  const canvasPadRight = Math.max(0, fw - 1 - bounds.right - m);
  const canvasPadTop = m;
  const canvasPadBottom = Math.max(4, fh - 1 - contentBounds.bottom + m);

  const manifest = {
    frameWidth: fw,
    frameHeight: fh,
    scale: MANIFEST.scale,
    anchor: MANIFEST.anchor,
    drawOffsetY: MANIFEST.drawOffsetY,
    feetLiftPx: MANIFEST.feetLiftPx,
    contentBounds,
    canvasPadTop,
    canvasPadBottom,
    canvasPadLeft,
    canvasPadRight,
    animations,
  };

  writeFileSync(join(outDir, "sprites.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(
    `Content bounds ${JSON.stringify(contentBounds)} → pads L${canvasPadLeft} R${canvasPadRight} T${canvasPadTop} B${canvasPadBottom}`,
  );
  console.log("Wrote sprites.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

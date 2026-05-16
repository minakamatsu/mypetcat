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
  scale: 3,
  anchor: "bottom",
  /** Feet line is fixed at canvas bottom; use padTop for tall poses only */
  drawOffsetY: 0,
  /** Nudge up on screen (source px); keep low so paws are not pushed under the bezel */
  feetLiftPx: 0,
  canvasPadTop: 28,
  /** Extra transparent rows below feet (source px) — avoids OS/WebView clipping last rows */
  canvasPadBottom: 8,
  /** Side padding so wide poses are not clipped when flipped */
  canvasPadLeft: 14,
  canvasPadRight: 14,
  animations: {
    sit: { tag: "Sit_1", file: "sit.png", fps: 5, loop: true, drawOffsetY: 0 },
    nap: { tag: "Dream", file: "nap.png", fps: 5, loop: true, drawOffsetY: 2 },
    walk: { tag: "W_1", file: "walk.png", fps: 9, loop: true, drawOffsetY: 0 },
    stretch: {
      tag: "Idle_3",
      file: "stretch.png",
      fps: 7,
      loop: false,
      drawOffsetY: -4,
    },
    look_tilt: {
      tag: "Idle_Tilt_1",
      file: "look_tilt.png",
      fps: 7,
      loop: false,
      drawOffsetY: -4,
    },
    look_lift: {
      tag: "Idle_Lift_1",
      file: "look_lift.png",
      fps: 7,
      loop: false,
      drawOffsetY: -8,
    },
    sit_tilt: {
      tag: "Sit_Tilt_1",
      file: "sit_tilt.png",
      fps: 7,
      loop: false,
      drawOffsetY: 0,
    },
    happy: {
      tag: "Idle_Yes",
      file: "happy.png",
      fps: 8,
      loop: false,
      drawOffsetY: -4,
    },
    scratch: {
      tag: "Scratching_Start",
      file: "scratch.png",
      fps: 8,
      loop: false,
      drawOffsetY: -6,
    },
    alert: {
      tag: "Idle_2",
      file: "alert.png",
      fps: 7,
      loop: false,
      drawOffsetY: -2,
    },
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

  const manifest = {
    frameWidth: MANIFEST.frameWidth,
    frameHeight: MANIFEST.frameHeight,
    scale: MANIFEST.scale,
    anchor: MANIFEST.anchor,
    drawOffsetY: MANIFEST.drawOffsetY,
    feetLiftPx: MANIFEST.feetLiftPx,
    canvasPadTop: MANIFEST.canvasPadTop,
    canvasPadBottom: MANIFEST.canvasPadBottom,
    canvasPadLeft: MANIFEST.canvasPadLeft,
    canvasPadRight: MANIFEST.canvasPadRight,
    animations,
  };

  writeFileSync(join(outDir, "sprites.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log("Wrote sprites.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

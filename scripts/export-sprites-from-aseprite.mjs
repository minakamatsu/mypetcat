/**
 * Export walk / idle / jump strips from assets/source/Cat_Grey.aseprite
 * into public/cat/ for the desktop pet runtime.
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

/** App animation name → Aseprite tag name */
const TAG_MAP = {
  walk: "W_1",
  idle: "Idle_Tilt_1",
  jump: "Jump_1",
};

const MANIFEST = {
  frameWidth: 32,
  frameHeight: 32,
  scale: 2,
  animations: {
    walk: { file: "walk.png", tag: "W_1", fps: 10, loop: true },
    idle: { file: "idle.png", tag: "Idle_Tilt_1", fps: 8, loop: true },
    jump: { file: "jump.png", tag: "Jump_1", fps: 12, loop: false },
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
    const tagName = TAG_MAP[key] ?? def.tag;
    const indices = tagFrameRange(ase, tagName);
    const { strip, frameCount } = await exportStrip(ase, indices);
    const outPath = join(outDir, def.file);
    writeFileSync(outPath, strip);
    console.log(`Wrote ${def.file} (${frameCount} frames, tag ${tagName})`);

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
    animations,
  };

  writeFileSync(join(outDir, "sprites.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log("Wrote sprites.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

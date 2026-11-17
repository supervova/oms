import { copyFile, mkdir, mkdtemp, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RASTER_EXTENSIONS = new Set(['.avif', '.jpeg', '.jpg', '.png', '.webp']);
const JPEG_OPTIONS = { chromaSubsampling: '4:4:4', progressive: true, quality: 85 };

async function listFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const nested = await Promise.all(entries.map(async (entry) => {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(location);
    if (entry.isFile()) return [location];
    return [];
  }));
  return nested.flat().sort();
}

async function optimizeRaster(sharp, source, target, extension) {
  const image = sharp(source, { animated: true });
  switch (extension) {
    case '.png':
      await image.png({ adaptiveFiltering: true, compressionLevel: 9 }).toFile(target);
      break;
    case '.jpg':
    case '.jpeg':
      await image.jpeg(JPEG_OPTIONS).toFile(target);
      break;
    case '.webp':
      await image.webp({ quality: 85 }).toFile(target);
      break;
    case '.avif':
      await image.avif({ quality: 60 }).toFile(target);
      break;
  }
}

/** Optimizes original assets and atomically replaces generated files. */
export async function buildImages({
  source = 'src/assets/img',
  output = 'public/assets/img',
  root = process.cwd(),
} = {}) {
  const sourceDir = path.resolve(root, source);
  const outputDir = path.resolve(root, output);
  const files = await listFiles(sourceDir);
  if (files.length === 0) {
    await rm(outputDir, { force: true, recursive: true });
    console.log('[images] No source files; generated images cleared.');
    return;
  }

  // Sharp is needed only when there are raster images.
  const hasRaster = files.some((file) => RASTER_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const sharp = hasRaster ? (await import('sharp')).default : null;
  await mkdir(path.dirname(outputDir), { recursive: true });
  const stagingDir = await mkdtemp(path.join(path.dirname(outputDir), '.img-build-'));
  const previousDir = `${stagingDir}-previous`;

  try {
    // Limit concurrency for photo-heavy builds to avoid excessive memory usage.
    const jobs = [...files];
    const workers = Array.from({ length: Math.min(4, jobs.length) }, async () => {
      while (jobs.length) {
        const input = jobs.shift();
        const relative = path.relative(sourceDir, input);
        const target = path.join(stagingDir, relative);
        const extension = path.extname(input).toLowerCase();
        await mkdir(path.dirname(target), { recursive: true });
        if (!RASTER_EXTENSIONS.has(extension)) {
          await copyFile(input, target);
          continue;
        }
        await optimizeRaster(sharp, input, target, extension);
        const [before, after] = await Promise.all([stat(input), stat(target)]);
        if (after.size >= before.size) await copyFile(input, target);
      }
    });
    await Promise.all(workers);

    let backedUp = false;
    try {
      await rename(outputDir, previousDir);
      backedUp = true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    try {
      await rename(stagingDir, outputDir);
    } catch (error) {
      if (backedUp) await rename(previousDir, outputDir);
      throw error;
    }
    if (backedUp) await rm(previousDir, { force: true, recursive: true });
  } finally {
    await rm(stagingDir, { force: true, recursive: true });
  }
  console.log(`[images] Built ${files.length} files in ${output}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildImages().catch((error) => {
    console.error('[images] Build failed:', error);
    process.exitCode = 1;
  });
}

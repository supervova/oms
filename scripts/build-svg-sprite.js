import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Generates a symbol sprite while preserving IDs derived from SVG filenames. */
export async function buildSvgSprite({
  source = 'src/assets/icons',
  output = 'public/assets/icons',
  root = process.cwd(),
} = {}) {
  const sourceDir = path.resolve(root, source);
  const outputFile = path.resolve(root, output, 'sprite.svg');
  let entries;
  try {
    entries = await readdir(sourceDir, { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    entries = [];
  }
  const icons = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.svg'))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (icons.length === 0) {
    await rm(outputFile, { force: true });
    console.log('[icons] No SVG icons; generated sprite cleared.');
    return;
  }

  const { default: SVGSpriter } = await import('svg-sprite');
  const spriter = new SVGSpriter({
    mode: { symbol: { dest: '.', sprite: 'sprite.svg' } },
    shape: {
      id: { generator: (name) => path.basename(name, '.svg') },
      transform: [],
    },
    svg: { xmlDeclaration: false, doctypeDeclaration: false },
  });

  for (const icon of icons) {
    const filename = path.join(sourceDir, icon.name);
    spriter.add(filename, icon.name, await readFile(filename, 'utf8'));
  }
  const generated = await new Promise((resolve, reject) => {
    spriter.compile((error, result) => error ? reject(error) : resolve(result));
  });

  await mkdir(path.dirname(outputFile), { recursive: true });
  // Atomic write protects dev server from serving a partially written SVG.
  const temporaryFile = `${outputFile}.tmp`;
  try {
    await writeFile(temporaryFile, generated.symbol.sprite.contents);
    await rm(outputFile, { force: true });
    await (await import('node:fs/promises')).rename(temporaryFile, outputFile);
  } finally {
    await rm(temporaryFile, { force: true });
  }
  console.log(`[icons] Sprite generated from ${icons.length} icons.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildSvgSprite().catch((error) => {
    console.error('[icons] Build failed:', error);
    process.exitCode = 1;
  });
}

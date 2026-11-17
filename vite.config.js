import path from 'node:path';
import { defineConfig } from 'vite';
import { buildImages } from './scripts/build-images.js';
import { buildSvgSprite } from './scripts/build-svg-sprite.js';

/**
 * Prepare generated public assets before Vite starts or copies public/ for build.
 * Vite's own watcher handles new/change/delete events; no separate pnpm --watch needed.
 */
function generatedAssets() {
  let root = process.cwd();
  const sources = [
    { directory: 'src/assets/img', run: () => buildImages({ root }) },
    { directory: 'src/assets/icons', run: () => buildSvgSprite({ root }) },
  ];

  return {
    name: 'oh-my-shine-generated-assets',
    async configResolved(config) {
      root = config.root;
      // Build outputs must exist before Vite copies public/ into dist/.
      await Promise.all(sources.map(({ run }) => run()));
    },
    configureServer(server) {
      const folders = sources.map(({ directory }) => path.resolve(root, directory));
      server.watcher.add(folders);
      const queues = new Map();
      const timers = new Map();

      function onChange(file) {
        const absolute = path.resolve(file);
        const target = sources.find(({ directory }) => {
          const folder = path.resolve(root, directory);
          return absolute.startsWith(`${folder}${path.sep}`);
        });
        if (!target) return;
        clearTimeout(timers.get(target.directory));
        timers.set(
          target.directory,
          setTimeout(() => {
            const previous = queues.get(target.directory) ?? Promise.resolve();
            const next = previous.catch(() => {}).then(() => target.run());
            queues.set(target.directory, next);
            next
              .then(() => {
                server.ws.send({ type: 'full-reload' });
              })
              .catch((error) => {
                server.config.logger.error(`[assets] ${target.directory}: ${error.stack ?? error}`);
                server.ws.send({
                  type: 'error',
                  err: {
                    message: `Failed to generate ${target.directory}`,
                    stack: error.stack ?? String(error),
                  },
                });
              });
          }, 150)
        );
      }

      for (const event of ['add', 'change', 'unlink', 'addDir', 'unlinkDir']) {
        server.watcher.on(event, onChange);
      }
      server.httpServer?.once('close', () => {
        for (const timer of timers.values()) clearTimeout(timer);
        for (const event of ['add', 'change', 'unlink', 'addDir', 'unlinkDir']) {
          server.watcher.off(event, onChange);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [generatedAssets()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    assetsInlineLimit: 0,
    rolldownOptions: {
      output: {
        entryFileNames: 'assets/js/[name]-[hash].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: ({ names }) => {
          const name = names[0] ?? '';
          if (/\.css$/i.test(name)) return 'assets/css/[name]-[hash][extname]';
          if (/\.(woff2?|ttf|otf|eot)$/i.test(name)) return 'assets/fonts/[name]-[hash][extname]';
          if (/\.(png|jpe?g|webp|avif|gif|svg)$/i.test(name))
            return 'assets/img/[name]-[hash][extname]';
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
});

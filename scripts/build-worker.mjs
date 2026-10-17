// Bundles the preview worker (and the raster engine it uses) into public/lamp-worker.js.
// Runs before `next dev` and `next build` (see package.json).
import { build } from 'esbuild';
await build({
  entryPoints: ['src/components/maker/lamp.worker.js'],
  bundle: true, minify: true, format: 'iife', target: 'es2020',
  outfile: 'public/lamp-worker.js', legalComments: 'none',
});
console.log('built public/lamp-worker.js');

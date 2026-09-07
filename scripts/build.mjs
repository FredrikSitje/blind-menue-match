import { build } from 'esbuild';
await build({
  stdin: { contents: "export { createClient } from '@supabase/supabase-js';", resolveDir: process.cwd() },
  bundle: true, format: 'esm', platform: 'browser', target: ['safari15'],
  outfile: 'js/vendor/supabase.js', minify: true, legalComments: 'linked',
});

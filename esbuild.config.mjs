import esbuild from 'esbuild';
await esbuild.build({entryPoints:['src/main.ts'],outfile:'main.js',bundle:true,format:'cjs',platform:'browser',target:'es2021',external:['obsidian','electron'],minify:false,sourcemap:false,logLevel:'info'});

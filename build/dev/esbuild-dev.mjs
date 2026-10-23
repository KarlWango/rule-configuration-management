import esbuild from 'esbuild';

await esbuild.build({
	entryPoints: ['src/dev/harness.ts'],
	bundle: true,
	format: 'iife',
	platform: 'browser',
	target: 'es2020',
	outfile: 'build/dev/rcm-dev.js',
	logLevel: 'info',
});
console.log('dev bundle ready');
import * as esbuild from 'esbuild'


// process.env.NODE_ENV might also work?
const prod = process.argv.includes('--prod');


/** @type {import('esbuild').BuildOptions} */
const config = {
    entryPoints: [
        "./src/pages/spa.ts",
        "./src/jpdb-content.tsx"
    ],
    bundle: true,
    minify: prod,
    sourcemap: !prod ? "inline" : false,
    outdir: "./dist/js",
    logLevel: "info",
}

if (prod) {
    await esbuild.build(config)
} else {
    const context = await esbuild.context(config)
    await context.watch();
}

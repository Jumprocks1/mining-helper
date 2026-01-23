import * as esbuild from 'esbuild'


// process.env.NODE_ENV might also work?
const prod = process.argv.includes('--prod');
const hotReloadCss = process.argv.includes('--hot-reload-css');


/** @type {import('esbuild').BuildOptions} */
const config = {
    entryPoints: [
        "./src/pages/spa.tsx",
        "./src/jpdb-content.tsx"
    ],
    bundle: true,
    minify: prod,
    sourcemap: !prod ? "inline" : false,
    outdir: "./dist/js",
    logLevel: "info",
    define: {
        HOT_RELOAD_CSS: String(hotReloadCss)
    }
}

if (prod) {
    await esbuild.build(config)
} else {
    const context = await esbuild.context(config)
    await context.watch();
}

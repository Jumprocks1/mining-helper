import * as esbuild from 'esbuild'


// process.env.NODE_ENV might also work?
const prod = process.argv.includes('--prod')
const watch = process.argv.includes('--watch')
const hotReloadCss = process.argv.includes('--hot-reload-css')
const githubPages = process.argv.includes('--gh-pages')
const serve = process.argv.includes('--serve')

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
        HOT_RELOAD_CSS: String(hotReloadCss),
        GITHUB_PAGES: String(githubPages)
    }
}

if (watch) {
    const context = await esbuild.context(config)
    await context.watch();
} else if (serve) {
    const context = await esbuild.context(config)
    await Promise.any([context.serve({ servedir: "dist", fallback: "dist/index.html" }), context.watch()])
} else {
    await esbuild.build(config)
}

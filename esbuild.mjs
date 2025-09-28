import * as esbuild from 'esbuild'

const context = await esbuild.context({
    entryPoints: [
        "./src/popup.ts"
    ],
    bundle: true,
    // minify: true,
    sourcemap: process.env.NODE_ENV !== "production",
    outdir: "./dist/js",
    logLevel: "info"

})
await context.watch();
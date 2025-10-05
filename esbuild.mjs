import * as esbuild from 'esbuild'

const context = await esbuild.context({
    entryPoints: [
        "./src/popup.ts",
        "./src/jpdb-inject.ts",
        "./src/jpdb-content.ts",
        "./src/ss-content.ts",
        "./src/subtitles/mpv.ts"
    ],
    bundle: true,
    // minify: true,
    sourcemap: process.env.NODE_ENV !== "production" ? "inline" : false,
    outdir: "./dist/js",
    logLevel: "info"

})
await context.watch();
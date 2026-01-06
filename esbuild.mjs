import * as esbuild from 'esbuild'

const context = await esbuild.context({
    entryPoints: [
        "./src/popup.tsx",
        "./src/anki/anki.tsx",
        "./src/jpdb-content.tsx",
        "./src/pages/subtitles/subtitles.tsx",
        "./src/pages/ss/ss.tsx"
    ],
    bundle: true,
    // minify: true,
    sourcemap: process.env.NODE_ENV !== "production" ? "inline" : false,
    outdir: "./dist/js",
    logLevel: "info"

})
await context.watch();
import * as esbuild from 'esbuild'

const context = await esbuild.context({
    entryPoints: [
        "./src/popup.tsx",
        "./src/anki/anki.tsx",
        "./src/jpdb-inject.ts",
        "./src/jpdb-content.ts",
        "./src/subtitles/subs.tsx",
        "./src/pages/ss/ss.tsx"
    ],
    bundle: true,
    // minify: true,
    sourcemap: process.env.NODE_ENV !== "production" ? "inline" : false,
    outdir: "./dist/js",
    logLevel: "info"

})
await context.watch();
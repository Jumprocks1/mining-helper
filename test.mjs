import * as esbuild from "esbuild";
import { spawn } from "node:child_process";

/** @type {import('esbuild').BuildOptions} */
const config = {
    entryPoints: ["./src/tests/test.ts"],
    bundle: true,
    minify: false,
    sourcemap: "inline",
    outdir: "./dist/js",
    define: {
        HOT_RELOAD_CSS: String(false),
        TEST: "true"
    }
}

await esbuild.build(config)

const child = spawn(
    process.execPath, // node
    ["--enable-source-maps", "./dist/js/test.js"],
    { stdio: "inherit" }
);

await new Promise((resolve, reject) => {
    child.on("exit", resolve);
    child.on("error", reject);
});
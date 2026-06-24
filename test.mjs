import * as esbuild from "esbuild";
import { spawn } from "node:child_process";

const watch = process.argv.includes('--watch')

const run = () => spawn(
    process.execPath, // node
    ["--enable-source-maps", "./dist/js/test.js"],
    { stdio: "inherit" }
)

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

// TODO is debugging possible?
if (watch) {
    /** @type {ChildProcess | undefined} */
    let child = undefined
    /** @type {esbuild.Plugin} */
    const runAfterBuildPlugin = {
        name: "run-after-build",
        setup(build) {
            build.onEnd(result => {
                if (result.errors.length > 0) return
                if (child) child.kill()
                child = run()
            })
        }
    }
    config.plugins = [runAfterBuildPlugin]
    const context = await esbuild.context(config)
    await context.watch();
} else {
    await esbuild.build(config)
    const child = run()
    await new Promise((resolve, reject) => {
        child.on("exit", resolve);
        child.on("error", reject);
    });
}

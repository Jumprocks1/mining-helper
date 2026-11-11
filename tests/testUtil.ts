import { styleText } from "node:util"

declare global {
    interface ErrorConstructor {
        captureStackTrace(targetObject: object, constructorOpt?: Function): void
    }
}

const tests: TestInfo[] = []

interface TestInfo extends TestInfoBase {
    run: () => void | Promise<void>
}

interface TestInfoBase {
    name: string
    tags?: string
    skipByDefault?: boolean
}

export function test(name: string, run: TestInfo["run"]): void
export function test(info: Omit<TestInfo, "run">, run: TestInfo["run"]): void
export function test(info: TestInfo): void
export function test(name: string | Omit<TestInfo, "run"> & { run?: TestInfo["run"] }, run?: TestInfo["run"]) {
    if (typeof name === "string")
        tests.push({ name, run: run! })
    else {
        if (run) name.run = run
        tests.push(name as TestInfo)
    }
}

export async function executeTests() {
    const boundary: { stack?: any } = {}
    Error.captureStackTrace(boundary, executeTests)
    const boundaryLines = boundary.stack.split('\n')

    const args = process.argv.slice(2)
    let filter = ""
    let pos = 0
    for (let i = 0; i < args.length; i++) {
        if (!args[i].startsWith("-")) {
            if (pos === 0) {
                filter = args[i]
                pos += 1
            }
        }
    }

    let filteredTests = tests

    if (filter) {
        const regex = new RegExp(filter, "i")
        filteredTests = tests.filter(e => e.name.match(regex) || e.tags?.match(filter))
    } else {
        filteredTests = tests.filter(e => !e.skipByDefault)
    }

    console.log(`Running ${filteredTests.length} tests`)
    let total = 0
    let passed = 0
    for (const test of filteredTests) {
        total += 1
        try {
            const r = test.run()
            if (r instanceof Promise) await r
            passed += 1
        } catch (e: any) {
            if (e.stack && boundary.stack) {
                // this chops off extra meaningless stack info
                const errorLines = (e.stack as string).split('\n')
                const matchIndex = errorLines.indexOf(boundaryLines[1])
                if (matchIndex !== -1)
                    e.stack = errorLines.slice(0, matchIndex - 1).join('\n');
            }
            const name = styleText("redBright", test.name)
            console.error(`${name}:\n${indent("stack" in e ? e.stack : e, 2)}`)
        }
    }
    console.log(`${passed === total ? "🟢" : "🔴"} ${passed} / ${total}`)
}

function indent(s: string, c = 2) {
    const indentS = " ".repeat(c)
    return s.split("\n").map(e => indentS + e).join("\n")
}

class AssertError extends Error {
    constructor(message: string, capture: any) {
        super(message)
        Error.captureStackTrace(this, capture)
        this.name = "Assert"
    }
}

export const assert = {
    equal<T>(actual: T, expected: T) {
        if (actual !== expected) {
            if (Array.isArray(expected)) {
                // Obviously this isn't great but that's fine for now
                const actualS = JSON.stringify(actual)
                const expectedS = JSON.stringify(expected)
                if (actualS !== expectedS) throw new AssertError(`Expected ${expectedS}, got ${actualS}`, assert.equal)
            } else {
                throw new AssertError(`Expected ${expected}, got ${actual}`, assert.equal)
            }
        }
    }
}
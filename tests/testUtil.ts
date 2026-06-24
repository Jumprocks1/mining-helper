import { styleText } from "node:util"

declare global {
    interface ErrorConstructor {
        captureStackTrace(targetObject: object, constructorOpt?: Function): void
    }
}

const tests: TestInfo[] = []

interface TestInfo {
    name: string
    run: () => void
}

export function test(name: string, run: TestInfo["run"]) {
    tests.push({ name, run })
}

export function executeTests() {
    const boundary: { stack?: any } = {}
    Error.captureStackTrace(boundary, executeTests)
    const boundaryLines = boundary.stack.split('\n')

    console.log(`Running ${tests.length} tests`)
    // TODO add filters
    let total = 0
    let passed = 0
    for (const test of tests) {
        total += 1
        try {
            test.run()
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
        if (actual !== expected) throw new AssertError(`Expected ${expected}, got ${actual}`, assert.equal)
    }
}
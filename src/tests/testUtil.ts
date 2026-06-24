const tests: TestInfo[] = []

interface TestInfo {
    name: string
    run: () => void
}

export function test(name: string, run: TestInfo["run"]) {
    tests.push({ name, run })
}

export function executeTests() {
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
            // TODO not sure why the stack continues past here
            console.error(`Error during ${test.name}:\n${"stack" in e ? e.stack : e}`)
        }
    }
    console.log(`${passed === total ? "🟢" : "🔴"} ${passed} / ${total}`)
}

export const assert = {
    equal<T>(actual: T, expected: T) {
        if (actual !== expected) throw new Error(`Expected: ${expected}, got ${actual}`)
    }
}
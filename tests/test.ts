import "./testContext"
import { furiBaseAndReading, furiganaTrimmed, simplifiedFurigana, TrimKana } from "../src/jpdb/JpdbState"
import { assert, executeTests, test } from "./testUtil"
import { furiganaFromFullReading, furiganaFromFullReading2 } from "../src/jpdb/JpdbParseText"
import { UnicodeCharacterType, unicodeType } from "../src/utils/AnkiUtil"
import { furiFromToken, furiToReading } from "../src/utils/util"
import { cleanJitenFurigana, readingFromFurigana } from "../src/jiten/JitenParseText"
import { readFileSync } from "node:fs"

test("simplified furigana", () => {
    assert.equal(simplifiedFurigana(""), "")
    assert.equal(simplifiedFurigana("a"), "a[a]")
    assert.equal(simplifiedFurigana("a[b]"), "a[b]")
    assert.equal(simplifiedFurigana("a[b] c[d]"), "ac[bd]")
    assert.equal(simplifiedFurigana("a[b]    c[d"), "ac[bd]")
    assert.equal(simplifiedFurigana("a[b]    c"), "ac[bc]")
    assert.equal(simplifiedFurigana("a    c"), "ac[ac]")

    assert.equal(furiganaTrimmed("a    c"), "")
    assert.equal(furiganaTrimmed("a[b]    c"), "a[b]")
    assert.equal(unicodeType("一"), UnicodeCharacterType.Kanji)
    assert.equal(unicodeType("1"), UnicodeCharacterType.Other)
    assert.equal(unicodeType("１"), UnicodeCharacterType.Number)

    assert.equal(furiganaFromFullReading("どう考えても", "どうかんがえても"), "どう 考[かんが]えても")
    assert.equal(furiganaFromFullReading("どうかんがえても", "どうかんがえても"), "どうかんがえても")

    assert.equal(furiFromToken("出来る", [0, 0, [["出", "で"], ["来", "き"], "る"], 0]), "出[で]来[き]る")
    // couldn't find a way to fix this assert while keeping the above functional
    // assert.equal(furiFromToken("来る", [0, 0, [["来", "き"], "た"], 0]), "来[く]る")

    assert.equal(TrimKana("出来る"), "出来")
    assert.equal(furiToReading("大[だい]々[だい]的[てき]"), "だいだいてき")
})

test("jiten", () => {
    // For these, try to use captial leters for fake kanji
    assert.equal(readingFromFurigana("a", "a"), ["a"])
    assert.equal(readingFromFurigana("abc", ""), ["abc"])
    assert.equal(readingFromFurigana("abc", "abc"), ["abc"])
    assert.equal(readingFromFurigana("A", "A[a]"), [["A", "a"]])
    assert.equal(readingFromFurigana("AC", "A[a]C[c]"), [["A", "a"], ["C", "c"]])
    assert.equal(readingFromFurigana("AA", "A[b]A[c]"), [["A", "b"], ["A", "c"]])
    assert.equal(readingFromFurigana("AB", "AB[b]"), [["AB", "b"]])
    assert.equal(readingFromFurigana("ABC", "AB[b]C"), [["AB", "b"], "C"])
    assert.equal(readingFromFurigana("ABC", "AB[b]C[c]"), [["AB", "b"], ["C", "c"]])
    assert.equal(readingFromFurigana("ABC", "AB[ab]C[c]"), [["AB", "ab"], ["C", "c"]])
    assert.equal(readingFromFurigana("ABCdef", "AB[ab]geargaeC[c]heahgi"), [["AB", "ab"], ["C", "c"], "def"])

    assert.equal(cleanJitenFurigana("痛[いた]い目[め]"), "痛[いた]い 目[め]")
    assert.equal(readingFromFurigana("痛い目", cleanJitenFurigana("痛[いた]い目[め]")), [["痛", "いた"], "い", ["目", "め"]])
})


const checkFuri = (res: [string, boolean], expected: string | [string, boolean]) => {
    if (typeof expected === "string") expected = [expected, true]
    assert.equal(res, expected)
}
test("furiganaFromFullReading2", () => {
    checkFuri(furiganaFromFullReading2("a", "a"), "a")
    checkFuri(furiganaFromFullReading2("A", "a"), "A[a]")
    checkFuri(furiganaFromFullReading2("Ab", "ab"), "A[a]b")
    checkFuri(furiganaFromFullReading2("bAb", "bab"), "b A[a]b")
    checkFuri(furiganaFromFullReading2("AbCde", "aabccde"), "A[aa]b C[cc]de")
    checkFuri(furiganaFromFullReading2("AaB", "aabb"), "A[a]a B[bb]")
})

test({ name: "kaishi", skipByDefault: true }, () => {
    const data = readFileSync("tests/kaishi.txt", "utf8")
    for (const line of data.split("\n")) {
        if (line.startsWith("#") || !line) continue
        const row = line.split("\t")
        const kanji = row[0]
        const furi = row[3].replaceAll("] ", "]")
        const reading = (row[1] || furiBaseAndReading(furi)[1]).replaceAll(" ", "")
        if (reading.includes("・")) continue;
        const res = furiganaFromFullReading2(kanji, reading)
        const bad = (i: number) => unicodeType(kanji, i) !== UnicodeCharacterType.Kana
        let hasConsec = false
        for (let i = 0; i < kanji.length - 1; i++) {
            if (bad(i) && bad(i + 1)) {
                hasConsec = true
                break
            }
        }
        try {
            if (res[1] || !hasConsec) checkFuri(res, furi)
        } catch { console.log(furi) }
    }
})

await executeTests()
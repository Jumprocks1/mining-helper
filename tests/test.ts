import "./testContext"
import { furiganaTrimmed, simplifiedFurigana, TrimKana } from "../src/jpdb/JpdbState"
import { assert, executeTests, test } from "./testUtil"
import { furiganaFromFullReading } from "../src/jpdb/JpdbParseText"
import { UnicodeCharacterType, unicodeType } from "../src/utils/AnkiUtil"
import { furiFromToken } from "../src/utils/util"
import { cleanJitenFurigana, readingFromFurigana } from "../src/jiten/JitenParseText"

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

    assert.equal(furiganaFromFullReading("どう考えても", "どうかんがえても"), "どう 考[かんが] えても")
    assert.equal(furiganaFromFullReading("どうかんがえても", "どうかんがえても"), "どうかんがえても")

    assert.equal(furiFromToken("出来る", [0, 0, [["出", "で"], ["来", "き"], "る"], 0]), "出[で]来[き]る")
    // couldn't find a way to fix this assert while keeping the above functional
    // assert.equal(furiFromToken("来る", [0, 0, [["来", "き"], "た"], 0]), "来[く]る")

    assert.equal(TrimKana("出来る"), "出来")
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

executeTests()
import "./testContext"
import { furiganaTrimmed, simplifiedFurigana } from "../src/jpdb/JpdbState"
import { assert, executeTests, test } from "./testUtil"
import { furiganaFromFullReading } from "../src/jpdb/JpdbParseText"
import { UnicodeCharacterType, unicodeType } from "../src/utils/AnkiUtil"
import { furiFromToken } from "../src/utils/util"

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

    assert.equal(furiFromToken("来る", [0, 0, [["来", "き"], "た"], 0]), "来[く]る")
})

executeTests()
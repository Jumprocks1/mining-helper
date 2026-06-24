import "./testContext"
import { furiganaTrimmed, simplifiedFurigana } from "../src/jpdb/JpdbState"
import { assert, executeTests, test } from "./testUtil"

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

    assert.equal(1, 2)
})

executeTests()
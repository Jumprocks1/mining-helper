import BrowserCache from "../../utils/BrowserCache";
import { fetchSource } from "../../utils/Sources";

interface RadicalInfo {
    kanji: string
    meaning: string
}
interface KanjiPart {
    part: string
    meaning?: string
}

interface KanjiInfoBase {
    kanji: string
    parts?: KanjiPart[]
    strokeCount: number
    meanings: string[]
    kunReadings: string[]
    onReadings: string[]
    nameReadings: string[]
}

export interface KanjiInfo extends KanjiInfoBase {
    radical: RadicalInfo
}
interface SimplifiedKanjiInfo extends KanjiInfoBase {
    radicalIndex: number
}
interface KanjiInfoStore { kanji: Record<string, SimplifiedKanjiInfo>, radicals: RadicalInfo[] }

export async function getKanjiInfo(kanji: string): Promise<KanjiInfo> {
    const store = await getKanjiInfoStore()
    const info = store.kanji[kanji]
    return {
        ...info,
        radical: store.radicals[info.radicalIndex],
    }
}

let kanjiDictionaryPromise: Promise<KanjiInfoStore> | undefined = undefined
const kanjiInfoStoreCache = new BrowserCache("kanji-info-store", 10_000_000, 1)
// This is quite slow on first run, but hardly matter since once cached it's instant
async function getKanjiInfoStore() {
    // Could compress this a bunch, but it being ~3MB JSON is really not that bad
    return (kanjiDictionaryPromise ??= kanjiInfoStoreCache.GetJson("v2", loadKanjiDictionaryNoCache))
}

async function loadKanjiDictionaryNoCache(): Promise<KanjiInfoStore> {
    const o: Record<string, SimplifiedKanjiInfo> = {}

    function getStrokeCount(part: string) {
        const e = o[part]
        if (e) return e.strokeCount
        if (part === "｜") return 1
        if (part === "ノ") return 1
        if (part === "ヨ") return 3
        if (part === "ユ") return 2
        if (part === "ハ") return 2
        if (part === "マ") return 2
        return 2 // shouldn't be any of these, but 2 is a good guess
    }

    const radicals: RadicalInfo[] = await getRadicals()
    {
        const data = (await decompressed("kanjidic2.xml.gz"))
        const xmlText = await new Response(data).text()
        const xml = new DOMParser().parseFromString(xmlText, "application/xml")
        const nodes = xml.querySelectorAll("character")
        // TODO this is really slow, I think if we add some await's, JS won't freeze
        for (const node of nodes) {
            const parsed = readCharacterXml(node)
            o[parsed.kanji] = parsed
        }
    }
    {
        const reader = (await decompressed("kradfile.gz")).pipeThrough(new TextDecoderStream("EUC-JP")).getReader()
        for await (const line of readLines(reader)) {
            if (line.startsWith('#')) continue
            const spl = line.split(":", 2)
            const kanji = spl[0].trim()
            const parts: KanjiPart[] = []
            const kanjiInfo = o[kanji]
            if (!kanjiInfo) throw `${kanji} not found`
            for (const part of spl[1].trim().split(' ')) {
                // Contains checks for variants
                const radicalI = radicals.findIndex(e => e.kanji.includes(part))
                // If one of the parts is the kanji (or main radical) itself, no need to include it
                // if the part is the entire kanji but that kanji also appears inside a radical definition,
                //   we use that updated meaning
                if ((part == kanji && radicalI === -1) || radicalI == kanjiInfo.radicalIndex) continue;
                let meaning = radicals[radicalI]?.meaning
                if (!meaning) {
                    const partInfo = o[part]
                    if (partInfo) meaning = partInfo.meanings.join(", ")
                }
                parts.push({ part, meaning })
            }
            parts.sort((a, b) => getStrokeCount(a.part) - getStrokeCount(b.part))
            kanjiInfo.parts = parts
        }
    }
    return { kanji: o, radicals }
}

async function* readLines(reader: ReadableStreamDefaultReader<string>) {
    let o = ""
    while (true) {
        const { value, done } = await reader.read()

        if (done) {
            if (o) yield o
            return
        }

        o += value

        let newline: number
        while ((newline = o.indexOf("\n")) !== -1) {
            let line = o.slice(0, newline)
            o = o.slice(newline + 1)
            if (line.endsWith("\r"))
                line = line.slice(0, -1)
            yield line
        }
    }
}

async function decompressed(source: string) {
    const gz = (await fetchSource(source))
    return gz.pipeThrough(new DecompressionStream("gzip"))
}

function readCharacterXml(node: Element): SimplifiedKanjiInfo {
    const radical = node.querySelector("radical")!
    const readingMeaning = node.querySelector("reading_meaning")
    const rmGroup = readingMeaning?.querySelector("rmgroup")
    return {
        kanji: node.querySelector("literal")!.textContent,
        radicalIndex: parseInt(radical.querySelector("[rad_type=classical]")!.textContent!) - 1,
        meanings: rmGroup ? [...rmGroup.querySelectorAll(`&> meaning:not([m_lang])`)].map(e => e.textContent) : [],
        kunReadings: rmGroup ? [...rmGroup.querySelectorAll(`&> reading[r_type=ja_kun]`)].map(e => e.textContent) : [],
        onReadings: rmGroup ? [...rmGroup.querySelectorAll(`&> reading[r_type=ja_on]`)].map(e => e.textContent) : [],
        nameReadings: readingMeaning ? [...readingMeaning.querySelectorAll("&> nanori")].map(e => e.textContent) : [],
        strokeCount: parseInt(node.querySelector("&> misc > stroke_count")!.textContent),
    }
}

async function getRadicals() {
    const reader = (await fetchSource("radicals.csv")).pipeThrough(new TextDecoderStream()).getReader()
    const o: RadicalInfo[] = []
    let header = true
    for await (const line of readLines(reader)) {
        if (header) { header = false; continue; }
        let i = 0
        function readField() {
            let quoted = false
            let s = ""
            while (i < line.length) {
                const c = line[i++]
                if (c == ',' && !quoted) return s
                if (c == '"' && i < line.length && line[i] == '"') {
                    s += '"'
                    i += 1
                }
                else if (c == '"') quoted = !quoted
                else s += c
            }
            return s
        }
        const kanji = readField()
        const _ = readField()
        o.push({ kanji, meaning: readField() })
    }
    return o
}
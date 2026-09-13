import { SelectOption } from "../components/Select"
import { BrowserStorage } from "../utils/BrowserApi"
import type { ReplacementEntry } from "../views/RegexReplacements"

type Milliseconds = number

// resets on page load
interface TemporarySettings {
    offset: Milliseconds
}

const defaultTemporarySettings: TemporarySettings = {
    offset: 0
}

function applyType<K extends string>(e: Record<K, { name: string, tooltip?: string }>) { return e }
export const AnkiFieldInfo = applyType({
    // Vocab fields
    word: { name: "Word", tooltip: "Raw kanji for word, ex: 時間" },
    wordReading: { name: "Word Reading", tooltip: "Kana reading for word, ex: じかん" },
    wordMeaning: { name: "Word Meaning", tooltip: "English meaning of word, ex: time, hour" },
    wordFurigana: { name: "Word Furigana", tooltip: "Kanji with furigana, ex: 時[じ] 間[かん]" },
    sentence: { name: "Sentence" },
    sentenceMeaning: { name: "Sentence Meaning" },
    sentenceFurigana: { name: "Sentence Furigana" },
    jpdbVid: { name: "Jpdb Vid", tooltip: "ID linking back to jpdb\nNot really used yet" },
    source: { name: "Source", tooltip: "Filename + timestamp for mined cards" },
    wordAudio: { name: "Word Audio" },
    sentenceAudio: { name: "Sentence Audio" },
    image: { name: "Image" },

    // Kanji fields
    // TODO
})

export type AnkiFieldKey = keyof typeof AnkiFieldInfo

export const furiganaModes = [
    ["kanjiOrVocab", "Kanji or Vocab"],
    ["unknownKanji", "Unknown Kanji"],
    ["unknownVocab", "Unknown Vocab"],
    // Could add `Kanji and Vocab` meaning it counts as needing furigana only if it's missing from both kanji and vocab
    ["always", "Always"],
    ["none", "None"],
] as const satisfies SelectOption[]
export type FuriganaMode = (typeof furiganaModes)[number][0]

// Pay attention to type widening and use casts where needed
// The alternative was having a separate interface, but that was way worse
export const defaultLocalSettings = {
    // Anki settings
    ankiConnectAddress: "http://127.0.0.1:8765",
    ankiConnectApiKey: "",

    ankiVocabDeck: "",
    ankiVocabModel: "",
    ankiVocabNoteFilter: "",

    ankiFields: {} as { [key in AnkiFieldKey]?: string },

    // Subtitle settings
    regexReplacements: [] as ReplacementEntry[],
    skipChapterRegex: "",
    skipAssStyleRegex: "",
    customCss: "",
    miningMaxRecommendedCount: 40,
    miningMaxFrequency: 20_000,
    miningTrimKana: true,
    miningChronological: false,
    volume: 0.6,
    defaultStartOffset: 0 as Milliseconds,
    defaultEndOffset: 100 as Milliseconds,

    // Reader settings
    furiganaMode: "kanjiOrVocab" as FuriganaMode,
    readerBodySelector: "",
    readerIgnoreSelector: "",
    tocWidth: 0,
    knownKanji: "", // this doesn't include the stuff imported from Anki. Have to combine the 2 sets

    // Global settings
    serverAddress: "127.0.0.1:4012",
    serverApiKey: "",
    jpdbApiKey: "",
    defaultTooltipDelay: 300 as Milliseconds,
    showUnknownVocabOnHover: false,
}
export type LocalSettings = typeof defaultLocalSettings

// make sure none of these settings are needed on immediately page load
const syncSettings = ["defaultTooltipDelay", "showUnknownVocabOnHover"] satisfies (keyof LocalSettings)[]
const cachedSettings: { [key in keyof LocalSettings]?: LocalSettings[key] } & TemporarySettings = {
    ...defaultTemporarySettings
}
type SyncSettingsKey = keyof TemporarySettings | (typeof syncSettings)[number]
export type AllSettings = LocalSettings & TemporarySettings
export type SettingsKey = keyof TemporarySettings | keyof LocalSettings

const listeners: { key: string, listener: (v: any) => void }[] = []

export function onSettingChange<K extends SettingsKey>(key: K, listener: (v: AllSettings[K]) => void) {
    listeners.push({ key, listener })
}
export function removeOnSettingChange<K extends SettingsKey>(key: K, listener: (v: AllSettings[K]) => void) {
    for (let i = listeners.length - 1; i >= 0; i--) {
        if (listeners[i].key === key && listeners[i].listener === listener) {
            listeners.splice(i, 1)
        }
    }
}

// if settings aren't loaded yet, this will return the default value
// this should be less than 10ms on page load
export function getSettingSync<K extends SyncSettingsKey>(key: K) {
    if (key in cachedSettings)
        return cachedSettings[key]
    // @ts-expect-error
    return defaultLocalSettings[key]
}

export function getDefaultSetting<K extends keyof AllSettings>(key: K): AllSettings[K] {
    if (key in defaultLocalSettings)
        // @ts-expect-error
        return defaultLocalSettings[key]
    // @ts-expect-error
    return defaultTemporarySettings[key]
}

export function getSetting<K extends keyof TemporarySettings>(key: K): TemporarySettings[K];
export function getSetting<K extends keyof LocalSettings>(key: K): Promise<LocalSettings[K]>;
export function getSetting<K extends SettingsKey>(key: K): AllSettings[K] | Promise<AllSettings[K]> {
    if (key in cachedSettings)
        // @ts-expect-error
        return cachedSettings[key]
    if (key in defaultLocalSettings)
        // we could probably store the results of this in cachedSettings
        return BrowserStorage.local.get({ [key]: defaultLocalSettings[key as keyof LocalSettings] }).then(e => e[key]) as Promise<AllSettings[K]>
    throw new Error()
}

// could be nice to have a promise ensuring these are loaded
for (const key of syncSettings) {
    getSetting(key).then(v => cachedSettings[key] = v as any)
}

export async function setSetting<K extends SettingsKey>(key: K, v: AllSettings[K]) {
    if (key in defaultLocalSettings) {
        // objects can have the same reference but still change
        if (typeof v !== "object" && key in cachedSettings && cachedSettings[key] === v) return
        cachedSettings[key] = v
        await BrowserStorage.local.set({ [key]: v })
        triggerSettingChanged(key, v)
    } else if (key in cachedSettings) {
        if (typeof v !== "object" && cachedSettings[key] === v) return
        cachedSettings[key] = v
        triggerSettingChanged(key, v)
    }
    else throw new Error()
}
export async function resetSetting<K extends keyof LocalSettings>(key: K) {
    if (key in defaultLocalSettings) {
        delete cachedSettings[key]
        await BrowserStorage.local.remove(key)
        // @ts-expect-error Key is already check, so this is fine
        triggerSettingChanged(key, defaultLocalSettings[key])
    } else throw new Error()
}
export function triggerSettingChanged<K extends SettingsKey>(key: K, v: AllSettings[K]) {
    for (const listener of listeners) {
        if (listener.key === key)
            listener.listener(v)
    }
}

import { getSetting } from "../views/SettingsModal"
import UserError, { ThrowUserError } from "./UserError"

export default {
    async callAny(action: string, params: any, version = 6) {
        const key = await getSetting("ankiConnectApiKey")
        const body = {
            action,
            version,
            params
        } as any
        if (key) body.key = key
        let res: Response
        try {
            res = await fetch(await getSetting("ankiConnectAddress"), {
                method: "POST",
                body: JSON.stringify(body)
            })
        } catch (e) {
            throw new UserError("Failed to connect to Anki\n" + e)
        }
        const json = await res.json()
        if (json.error) {
            if (json.error === "valid api key must be provided") {
                if (key)
                    ThrowUserError("AnkiConnect requires an API key.", "The current API key is invalid.")
                else
                    ThrowUserError("AnkiConnect requires an API key.", "Set this in the settings.")
            }
            throw new UserError(json.error)
        }
        return json.result
    },
    async call<K extends keyof AnkiConnectActionMap>(action: K, params: AnkiConnectActionMap[K]["params"], version = 6):
        Promise<AnkiConnectActionMap[K]["returns"]> {
        return this.callAny(action, params, version)
    }
}

export interface AnkiNote {
    noteId: number, // aka created on
    fields: Record<string, { value: string } | undefined>
}

interface AnkiConnectActionMap {
    deckNames: {
        params: undefined,
        returns: string[]
    },
    modelNames: {
        params: undefined,
        returns: string[]
    },
    modelFieldNames: {
        params: { modelName: string },
        returns: string[]
    },
    storeMediaFile: {
        params: {
            filename: string,
            data: string
        },
        returns: string
    },
    requestPermission: {
        params: undefined
        returns: {
            permission: "granted" | "denied",
            // docs are notably incorrect
            // they show requireApiKey, but the source here clearly shows requireApikey
            // https://git.sr.ht/~foosoft/anki-connect/tree/master/item/plugin/__init__.py#L416
            requireApikey: boolean
            version: number
        }
    },
    updateNote: {
        params: {
            note: NoteUpdate
        },
        returns: null
    },
    addNote: {
        params: { note: NoteAdd, }
        returns: number
    },
    addNotes: {
        params: { notes: NoteAdd[] }
        returns: string
    },
    guiBrowse: {
        params: {
            query: string, reorderCards?: {
                order: "descending" | "ascending",
                columnId: string
            }
        }, returns: number[]
    },
    findCards: { params: { query: string }, returns: number[] },
    notesInfo: { params: { query: string } | { notes: number[] }, returns: AnkiNote[] },
    guiSelectCard: { params: { card: number }, returns: boolean },
    multi: { params: { actions: [] }, returns: any },
    findNotes: { params: { query: string }, returns: number[] },
    getIntervals: { params: { cards: number[] }, returns: number[] },
    cardsToNotes: { params: { cards: number[] }, returns: number[] }
}

export interface NoteAdd extends NoteBase {
    deckName: string
    modelName: string
    options?: { allowDuplicate: boolean }
}

export interface NoteUpdate extends NoteBase {
    id: number,
}

export interface NoteBase {
    fields: Record<string, string | undefined>
    tags?: string[]
    audio?: MediaAdd[]
    video?: MediaAdd[]
    picture?: MediaAdd[]
}

export interface MediaAdd {
    data: string
    filename: string
    fields: string[]
} 
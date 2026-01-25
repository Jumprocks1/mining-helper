import { getSetting } from "../views/SettingsModal"
import UserError from "./UserError"

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
            if (json.error === "valid api key must be provided")
                throw new UserError("AnkiConnect requires an API key.\nSet this in the settings.")
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
    fields: { Word: { value: string }, Source: { value: string } }
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
    updateNote: {
        params: {
            note: {
                id: number,
                fields: Record<string, string>
                tags?: string[]
                audio?: MediaAdd[]
                video?: MediaAdd[]
                picture?: MediaAdd[]
            }
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
    notesInfo: { params: { query: string }, returns: AnkiNote[] },
    guiSelectCard: { params: { card: number }, returns: boolean },
    multi: { params: { actions: [] }, returns: any },
    findNotes: { params: { query: string }, returns: number[] }
}

interface NoteAdd {
    deckName: string
    modelName: string
    fields: Record<string, string | undefined>
    options?: { allowDuplicate: boolean }
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
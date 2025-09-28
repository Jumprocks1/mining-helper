export default class AnkiConnect {

    targetDeck = "Kaishi 1.5k"
    targetModel = "Kaishi 1.5k"

    constructor() {

    }

    async callAny(action: string, params: any, version = 6) {
        const res = await fetch("http://127.0.0.1:8765", {
            method: "POST",
            body: JSON.stringify({
                action,
                version,
                params
            })
        })
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        return json.result
    }
    async call<K extends keyof AnkiConnectActionMap>(action: K, params: AnkiConnectActionMap[K]["params"], version = 6):
        Promise<AnkiConnectActionMap[K]["returns"]> {
        return this.callAny(action, params, version)
    }
}

interface AnkiConnectActionMap {
    deckNames: {
        params: undefined,
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
            }
        },
        returns: string[]
    },
    addNote: {
        params: { note: NoteAdd, }
        returns: number
    },
    addNotes: {
        params: { notes: NoteAdd[] }
        returns: string
    },
    guiBrowse: { params: { query: string }, returns: number[] },
    guiSelectCard: { params: { card: number }, returns: boolean },
    multi: { params: { actions: [] }, returns: any }
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
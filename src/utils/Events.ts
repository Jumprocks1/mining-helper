import { CardData } from "./util"

type EventKey =
    "vocab-mined"

interface EventHandlers {
    "vocab-mined": (card: CardData) => void
}

const globalHandlers: {
    [key in keyof EventHandlers]?: EventHandlers[key][]
} = {}

export function RegisterEventHandler<Key extends EventKey>(key: Key, handler: EventHandlers[Key]) {
    const handlers = globalHandlers[key] ?? (globalHandlers[key] = []) as EventHandlers[Key][]
    handlers.push(handler)
}
export function ClearEventHandler<Key extends EventKey>(key: Key, handler: EventHandlers[Key]) {
    const handlers = globalHandlers[key] ?? (globalHandlers[key] = []) as EventHandlers[Key][]
    const index = handlers.indexOf(handler)
    if (index >= 0) handlers.splice(index, 1)
}

export function TriggerEvent<Key extends EventKey>(key: Key, ...params: Parameters<EventHandlers[Key]>) {
    const handlers = globalHandlers[key] as EventHandlers[Key][] | undefined
    if (!handlers) return
    for (const handler of handlers) {
        // @ts-expect-error
        handler(...params)
    }
}

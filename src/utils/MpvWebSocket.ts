import { getSetting } from "../views/SettingsModal"

export default class MpvWebSocket {
    Connection: WebSocket | undefined

    onMessage?: (e: MessageEvent<any>) => void
    onOpen?: () => void
    onClose?: (skipped?: true) => void
    onConnecting?: () => void
    onError: (e: Event) => void = console.error

    public get Open() {
        if (!this.Connection) return false
        return this.Connection.readyState === this.Connection.OPEN;
    }
    public get Connecting() {
        if (!this.Connection) return false
        return this.Connection.readyState === this.Connection.CONNECTING;
    }

    _openPromise: Promise<void> | undefined
    _openPromiseResolve: (() => void) | undefined
    // will also reconnect if needed
    public async Connect(initial?: true) {
        if (this.Connection) {
            if (this.Connecting || this.Open) return this._openPromise!
            this.Connection.close();
        }
        this._openPromise ??= new Promise<void>(e => this._openPromiseResolve = e)
        const apiKey = await getSetting("serverApiKey")
        const uri = this.Uri ?? `ws://${await getSetting("serverAddress")}`
        if (initial && !apiKey) {
            this._openPromiseResolve = undefined
            this.onClose?.(true);
            return
        }
        console.log("🟡 Connecting mpv WebSocket")
        this.Connection = new WebSocket(uri, apiKey ? [apiKey] : undefined);

        this.Connection.onopen = () => {
            this._openPromiseResolve?.()
            this._openPromiseResolve = undefined
            if (this.Connection) this.Connection.onmessage = e => this.onMessage?.(e)
            this.onOpen?.();
        };
        this.Connection.onclose = () => {
            this._openPromiseResolve = undefined
            this.onClose?.();
        }
        this.Connection.onerror = e => this.onError(e);
        this.onConnecting?.()
        return this._openPromise
    }

    Uri: string | undefined; // undefined => load from settings
    constructor(uri?: string) {
        this.Uri = uri
    }

    public async OpenAndSend(message: string) {
        await this.Connect()
        this.Connection?.send(message)
    }
    public SendIfOpen(message: string) {
        if (!this.Open) return
        this.Connection!.send(message)
    }

    Close() {
        this.Connection?.close()
        this.Connection = undefined
    }

    pendingRequests = new Map<string, (response: Uint8Array<ArrayBuffer> | string) => void>()
    nextRequestId = 1;
    public RequestIfOpen(message: string) {
        if (!this.Open) return
        return new Promise<Uint8Array<ArrayBuffer> | string>(res => {
            const requestId = this.nextRequestId++;
            this.SendIfOpen(`request:${requestId}:${message}`);
            this.pendingRequests.set(requestId.toString(), res)
        })
    }

    public async HandleResponse(response: string | Uint8Array<ArrayBuffer>) {
        if (typeof response === "string") {
            const spl = response.indexOf(":")
            const requestId = response.substring(0, spl);
            const commandValue = response.substring(spl + 1);
            const callback = this.pendingRequests.get(requestId)
            if (callback) {
                callback(commandValue)
                this.pendingRequests.delete(requestId)
            }
        } else {
            const spl = response.indexOf(":".charCodeAt(0))
            const requestId = new TextDecoder().decode(response.subarray(0, spl));
            const callback = this.pendingRequests.get(requestId)
            if (callback) {
                callback(response.subarray(spl + 1))
                this.pendingRequests.delete(requestId)
            }
        }
    }
}

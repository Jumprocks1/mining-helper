let ran = false

declare var HOT_RELOAD_CSS: boolean | undefined

export default () => {
    if (!HOT_RELOAD_CSS || ran) return
    ran = true
    const webSocket = new HotReloadWebSocket()
    webSocket.onMessage = e => {
        const message = e.data as string
        const spl = message.split(":", 2)
        if (spl[0] === "changed") {
            const path = spl[1].replaceAll("\\", "/")
            if (path === "dist/main.css") {
                const relPath = path.split("/", 2)[1]
                const links = document.querySelectorAll<HTMLLinkElement>(`head>link`)
                for (const link of links) {
                    const rootHref = link.href.split("?", 2)[0]
                    if (rootHref.endsWith("/" + relPath)) {
                        link.href = `${rootHref}?v=${new Date().getTime()}`
                    }
                }
            }
        }
    }
    webSocket.Connect()
}

class HotReloadWebSocket {
    Connection: WebSocket | undefined

    onMessage?: (e: MessageEvent<any>) => void
    onOpen?: () => void
    onClose?: () => void
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
    public Connect() {
        if (this.Connection) {
            if (this.Connecting || this.Open) return this._openPromise!
            this.Connection.close();
        }
        this._openPromise ??= new Promise<void>(e => this._openPromiseResolve = e)
        this.Connection = new WebSocket(this.Uri);

        this.Connection.onopen = () => {
            this._openPromiseResolve?.()
            this._openPromiseResolve = undefined
            if (this.Connection) this.Connection.onmessage = e => this.onMessage?.(e)
            this.onOpen?.();
            console.log("🟢 Hot reload CSS connected")
        };
        this.Connection.onclose = () => {
            this._openPromiseResolve = undefined
            this.onClose?.();
        }
        this.Connection.onerror = e => this.onError(e);
        this.onConnecting?.()
        return this._openPromise
    }

    Uri: string;
    constructor(uri: string = "ws://127.0.0.1:4013/") {
        this.Uri = uri
    }
}

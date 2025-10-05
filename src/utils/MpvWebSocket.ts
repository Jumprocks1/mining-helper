export default class MpvWebSocket {
    Connection: WebSocket

    onMessage?: (e: MessageEvent<any>) => void
    onOpen?: () => void
    onClose?: () => void
    onError: (e: Event) => void = console.error

    public get Open() {
        return this.Connection.readyState === this.Connection.OPEN;
    }
    public get Connecting() {
        return this.Connection.readyState === this.Connection.CONNECTING;
    }

    _openPromise: Promise<void> | undefined
    _openPromiseResolve: (() => void) | undefined
    public get OpenPromise() {
        return this._openPromise ??= new Promise<void>(e => this._openPromiseResolve = e)
    }

    constructor(uri: string = "ws://127.0.0.1:412/") {
        console.log("Connecting WebSocket")
        this.Connection = new WebSocket(uri);

        this.Connection.onopen = () => {
            this._openPromiseResolve?.()
            this._openPromiseResolve = undefined
            this.Connection.onmessage = e => this.onMessage?.(e)
            this.onOpen?.();
        };
        this.Connection.onclose = () => {
            this._openPromiseResolve = undefined
            this.onClose?.();
        }
        this.Connection.onerror = e => this.onError(e);
    }

    close() {
        this.Connection.close()
    }
}

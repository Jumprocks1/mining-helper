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

    pendingOpenPromises: (() => void)[] = []
    public get OpenPromise() {
        return new Promise<void>(e => this.pendingOpenPromises.push(e))
    }

    constructor(uri: string = "ws://127.0.0.1:412/") {
        console.log("Connecting WebSocket")
        this.Connection = new WebSocket(uri);

        this.Connection.onopen = () => {
            this.pendingOpenPromises.forEach(e => e())
            this.pendingOpenPromises = []
            this.Connection.onmessage = e => this.onMessage?.(e)
            this.onOpen?.();
        };
        this.Connection.onclose = () => {
            this.pendingOpenPromises = []
            this.onClose?.();
        }
        this.Connection.onerror = e => this.onError(e);
    }

    close() {
        this.Connection.close()
    }
}

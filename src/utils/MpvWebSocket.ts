export default class MpvWebSocket {
    Connection: WebSocket

    onMessage?: (e: MessageEvent<any>) => void
    onOpen?: () => void
    onClose?: () => void
    onError: (e: Event) => void = console.error

    constructor(uri: string = "ws://127.0.0.1:412/") {
        console.log("Connecting WebSocket")
        this.Connection = new WebSocket(uri);

        this.Connection.onopen = () => {
            this.Connection.onmessage = e => this.onMessage?.(e)
            this.onOpen?.();
        };
        this.Connection.onclose = () => {
            this.onClose?.();
        }
        this.Connection.onerror = e => this.onError(e);
    }

    close() {
        this.Connection.close()
    }
}

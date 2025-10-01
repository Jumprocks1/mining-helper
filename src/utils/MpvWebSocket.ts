const genRandomHex = (size: number) => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');

export default class MpvWebSocket {
    Id = genRandomHex(8)

    Connection: WebSocket

    onMessage?: (e: MessageEvent<any>) => void

    constructor(uri: string = "ws://127.0.0.1:412/") {
        console.log("Connecting WebSocket")
        this.Connection = new WebSocket(uri);

        this.Connection.onopen = () => {
            console.log("WebSocket connected")
            this.Connection.onmessage = e => this.onMessage?.(e)
        };
        this.Connection.onclose = () => {
            console.log("WebSocket closed");
        }
        this.Connection.onerror = console.error;
    }

    close() {
        this.Connection.close()
    }
}

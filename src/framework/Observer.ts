let observer: MutationObserver | undefined
let awaitingDeath: [node: Node, callback: (node: Node) => void][] = []

// pretty sure this is signficantly cheaper than most other ways of tracking this sort of thing
// childlist mutations are pretty rare and usually they come in batches, which this already handles as a single event
export function onDeath(node: Node, callback: (node: Node) => void) {
    if (!observer) {
        observer ??= new MutationObserver(() => {
            for (let i = awaitingDeath.length - 1; i >= 0; i--) {
                const node = awaitingDeath[i]
                if (!node[0].isConnected) {
                    awaitingDeath.splice(i, 1)
                    node[1](node[0])
                    if (awaitingDeath.length === 0 && observer) {
                        observer.disconnect()
                        observer = undefined
                    }
                }
            }
        })
        // kinda sucks we observe the entire document, but just listening on the parent doesn't work
        // issue is if multiple parents up is removed, it wouldn't trigger any events lower down
        observer.observe(document, { childList: true, subtree: true })
    }
    awaitingDeath.push([node, callback])
}
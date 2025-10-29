export default ({ load }: { load: Promise<Node | string> }) => {
    const node = <div className="loader" />
    load.then(e => node.replaceWith(e))
    return node
}
export default {
    flash(element: HTMLElement) {
        const id = "flash"
        element.getAnimations()
            .filter(e => e.id === id)
            .forEach(e => e.cancel)

        element.animate([
            { backgroundColor: "gray" },
            {}
        ], { duration: 300, id })
    }
} 
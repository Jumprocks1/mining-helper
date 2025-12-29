// meant to interface with `chrome` so things still work when run in SPA or Firefox (eventually)
// shouldn't reference `chrome` anywhere else

// TODO this isn't set up
export default {
    storage: {
        local: {
            get: () => {
            }
        },
        session: {
            get: () => {

            }
        }
    }
}
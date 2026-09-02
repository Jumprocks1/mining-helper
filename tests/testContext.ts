(globalThis as any).window = globalThis;
(globalThis as any).document = {};
(globalThis as any).browser = {
    storage: {
        local: {
            get: async () => ({})
        }
    }
}
(globalThis as any).window = globalThis;
(globalThis as any).document = {};
(globalThis as any).chrome = {
    storage: {
        local: {
            get: async () => ({})
        }
    }
}
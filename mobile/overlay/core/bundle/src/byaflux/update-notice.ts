type AvailableUpdate = { versionCode: number; versionName: string }
type UpdateNoticeOptions = {
    current(): AvailableUpdate | undefined
    subscribe(listener: () => void): () => void
    isActive(): boolean
    show(version: string, update: () => void): void
    open(): Promise<unknown>
    onError(error: unknown): void
}
export function connectUpdateNotice(options: UpdateNoticeOptions) {
    let active = true
    let announced = 0
    function present() {
        const update = options.current()
        if (
            !active ||
            !options.isActive() ||
            !update ||
            announced === update.versionCode
        )
            return
        announced = update.versionCode
        options.show(update.versionName, () => {
            void Promise.resolve()
                .then(() => options.open())
                .catch(options.onError)
        })
    }
    const unsubscribe = options.subscribe(present)
    present()
    return {
        present,
        dispose() {
            active = false
            unsubscribe()
        },
    }
}

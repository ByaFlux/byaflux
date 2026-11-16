/** Coalesces repeated clicks and restarts only after a successful update. */
export function createUpdateAndRestart(update: () => Promise<boolean>, restart: () => void) {
    let pending: Promise<void> | undefined;
    return () => {
        if (pending) return pending;
        pending = (async () => {
            if (!await update()) throw new Error("A atualização não foi aplicada. Tente novamente.");
            restart();
        })().finally(() => { pending = undefined; });
        return pending;
    };
}

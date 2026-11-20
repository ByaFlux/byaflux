import { describe, expect, it, vi } from 'vitest'
import { connectUpdateNotice } from '../../src/byaflux/update-notice'

function setup() {
    let available: { versionName: string; versionCode: number } | undefined
    let foreground = true
    const listeners = new Set<() => void>()
    const show = vi.fn()
    const open = vi.fn(async () => {})
    const onError = vi.fn()
    const notice = connectUpdateNotice({
        current: () => available,
        subscribe: fn => {
            listeners.add(fn)
            return () => {
                listeners.delete(fn)
            }
        },
        isActive: () => foreground,
        show,
        open,
        onError,
    })
    return {
        notice,
        show,
        open,
        onError,
        setActive(value: boolean) {
            foreground = value
        },
        emit(value = available) {
            available = value
            for (const fn of listeners) fn()
        },
    }
}
describe('Mobile update modal', () => {
    it('opens immediately after a manual check finds an update', () => {
        const f = setup()
        f.emit({ versionName: '0.2.3', versionCode: 20199 })
        expect(f.show).toHaveBeenCalledWith('0.2.3', expect.any(Function))
    })
    it('shows one modal per version and permits a later version', () => {
        const f = setup()
        f.emit({ versionName: '0.2.3', versionCode: 20199 })
        f.emit()
        expect(f.show).toHaveBeenCalledTimes(1)
        f.emit({ versionName: '0.2.3', versionCode: 20299 })
        expect(f.show).toHaveBeenCalledTimes(2)
    })
    it('waits for foreground and then presents the pending update', () => {
        const f = setup()
        f.setActive(false)
        f.emit({ versionName: '0.2.3', versionCode: 20199 })
        expect(f.show).not.toHaveBeenCalled()
        f.setActive(true)
        f.notice.present()
        expect(f.show).toHaveBeenCalledTimes(1)
    })
    it('opens the installer only when the update action is pressed', async () => {
        const f = setup()
        f.emit({ versionName: '0.2.3', versionCode: 20199 })
        expect(f.open).not.toHaveBeenCalled()
        const action = f.show.mock.calls[0]![1]
        action()
        await vi.waitFor(() => expect(f.open).toHaveBeenCalledTimes(1))
    })
    it('does not present a modal after shutdown', () => {
        const f = setup()
        f.notice.dispose()
        f.emit({ versionName: '0.2.3', versionCode: 20199 })
        f.notice.present()
        expect(f.show).not.toHaveBeenCalled()
    })
    it('reports a failed installer launch', async () => {
        const f = setup()
        f.open.mockRejectedValueOnce(Error('missing installer'))
        f.emit({ versionName: '0.2.3', versionCode: 20199 })
        f.show.mock.calls[0]![1]()
        await vi.waitFor(() => expect(f.onError).toHaveBeenCalled())
    })
})

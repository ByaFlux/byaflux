export const ExpandedBadgeLimit = Number.MAX_SAFE_INTEGER

export function expandBadgeLimit(
    module: Record<string, unknown>,
): (() => void) | undefined {
    const key = 'MAX_DISPLAYED_PROFILE_BADGES'
    const descriptor = Object.getOwnPropertyDescriptor(module, key)
    if (!descriptor) return
    let value: unknown
    try {
        value = module[key]
    } catch {
        return
    }
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 1)
        return
    if (descriptor.configurable) {
        const get = () => ExpandedBadgeLimit
        Object.defineProperty(module, key, {
            configurable: true,
            enumerable: descriptor.enumerable,
            get,
        })
        return () => {
            const current = Object.getOwnPropertyDescriptor(module, key)
            if (current?.get === get && current.configurable)
                Object.defineProperty(module, key, descriptor)
        }
    }
    if (!descriptor.writable || !Reflect.set(module, key, ExpandedBadgeLimit))
        return
    return () => {
        if (module[key] === ExpandedBadgeLimit) Reflect.set(module, key, value)
    }
}

export function expandedBadgeProps(props: Record<string, unknown>) {
    return {
        ...props,
        style: [props.style, { flexWrap: 'wrap', rowGap: 4, flexShrink: 1 }],
    }
}

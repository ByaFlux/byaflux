export const roleSectionExports = [
    'UserProfileRoles',
    'UserProfileRolesSection',
    'UserProfileRolesList',
    'ProfileRoles',
    'ProfileRolesSection',
    'GuildMemberRoles',
    'GuildMemberProfileRoles',
    'GuildMemberProfileRolesSection',
    'RolesSection',
    'RolesList',
    'Roles',
]
export const profileExports = [
    'UserProfile',
    'UserProfileHeader',
    'UserProfileBody',
    'UserProfileModal',
    'GuildMemberProfile',
    'ProfileHeader',
    'ProfileBody',
]
export interface ProfileRoleContext {
    userId: string
    guildId: string
    entryShown?: boolean
}
export function createProfileBridge(
    React: any,
    options: {
        enabled(): boolean
        useChanges(): void
        resolve(
            props: Record<string, any>,
            parent: ProfileRoleContext | null,
        ): ProfileRoleContext | undefined
        hasSelection(context: ProfileRoleContext): boolean
        project(
            props: Record<string, any>,
            context: ProfileRoleContext,
        ): Record<string, any>
        renderRoles(context: ProfileRoleContext): any
        renderAction(context: ProfileRoleContext): any
    },
) {
    const Context = React.createContext(null)
    const headers = new WeakSet<object>()
    const types = new WeakMap<
            object,
            'profile' | 'roles' | 'scoped' | 'scopedRoles'
        >(),
        wrappers = new WeakMap<object, any>()
    let creatingNative = false,
        matchedRoles = 0
    const native = (type: any, props: any) => {
        creatingNative = true
        try {
            return React.createElement(type, props)
        } finally {
            creatingNative = false
        }
    }
    function kind(type: any, props: Record<string, any>) {
        const known = types.get(type)
        if (known) return known
        const fn = type?.type ?? type?.render ?? type
        const name =
            typeof fn === 'function' ? (fn.displayName ?? fn.name ?? '') : ''
        if (
            /^(?:UserProfile|GuildMemberProfile|GuildMemberRoles|ProfileRoles|ProfileHeader|ProfileBody)/.test(
                name,
            ) &&
            !/Badge|Avatar|Banner|Button|FakeRoles/.test(name)
        )
            return /Roles(?:Section|List)?$/.test(name) ? 'roles' : 'profile'
        if (props.displayProfile || props.userProfile || props.profile?.userId)
            return 'profile'
        if (Array.isArray(props.roleIds) || Array.isArray(props.roles))
            return 'scoped'
        return undefined
    }
    function wrap(type: any) {
        let wrapped = wrappers.get(type)
        if (wrapped) return wrapped
        wrapped = function FakeRolesView(props: Record<string, any>) {
            options.useChanges()
            const parent = React.useContext(Context)
            const ctx = options.resolve(props, parent)
            if (!options.enabled() || !ctx) return native(type, props)
            const mode = kind(type, props),
                name = (type?.type ?? type?.render ?? type)?.name ?? ''
            if ((mode === 'scoped' || mode === 'scopedRoles') && !parent)
                return native(type, props)
            if (
                (mode === 'roles' || mode === 'scopedRoles') &&
                options.hasSelection(ctx)
            ) {
                matchedRoles++
                if (
                    Array.isArray(props.roles) ||
                    Array.isArray(props.roleIds) ||
                    Array.isArray(props.member?.roles)
                )
                    return native(type, options.project(props, ctx))
                return options.renderRoles(ctx)
            }
            const header =
                headers.has(type) ||
                /Header/.test(name) ||
                (types.get(type) === 'profile' &&
                    /Header/.test(type?.displayName ?? ''))
            const entry = !!parent?.entryShown || header
            return React.createElement(Context.Provider, {
                value: { ...ctx, entryShown: entry },
                children: [
                    native(
                        type,
                        options.hasSelection(ctx)
                            ? options.project(props, ctx)
                            : props,
                    ),
                    header && !parent?.entryShown
                        ? options.renderAction(ctx)
                        : null,
                ],
            })
        }
        wrappers.set(type, wrapped)
        return wrapped
    }
    return {
        register(type: unknown, mode: 'profile' | 'roles', name = '') {
            if (
                typeof type === 'function' ||
                (typeof type === 'object' && type !== null)
            ) {
                types.set(type, /^Roles/.test(name) ? 'scopedRoles' : mode)
                if (/Header/.test(name)) headers.add(type)
            }
        },
        patchArgs<T extends [unknown, unknown?, ...unknown[]]>(args: T): T {
            const type = args[0],
                props = (args[1] ?? {}) as Record<string, any>
            if (
                creatingNative ||
                !options.enabled() ||
                (typeof type !== 'function' &&
                    (typeof type !== 'object' || !type))
            )
                return args
            if (!kind(type, props)) return args
            args[1] = props
            args[0] = wrap(type)
            return args
        },
        matchedRoles: () => matchedRoles,
    }
}

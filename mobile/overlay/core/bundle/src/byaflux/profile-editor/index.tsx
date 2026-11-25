import { Design } from '@valenced/discord/design'
import { getModules } from '@valenced/modules/finders'
import { withName, withProps } from '@valenced/modules/finders/filters'
import { instead } from '@valenced/patcher'
import { Component, createElement, useEffect, useRef, useState } from 'react'
import { Alert, Modal, Pressable, Text, View } from 'react-native'
import { accountId, handleEditorRequest } from './runtime'
import { ProfileEditorHtml } from './web'
import type { ComponentType, ReactNode } from 'react'

type Props = Record<string, any>
let WebView: ComponentType<Props> | undefined
const listeners = new Set<() => void>()
const announce = () => {
    for (const listener of listeners) listener()
}
getModules(withProps<{ WebView: ComponentType<Props> }>('WebView'), module => {
    WebView = module.WebView
    announce()
})
getModules(
    withProps<
        ComponentType<Props> & { isFileUploadSupported(): Promise<boolean> }
    >('isFileUploadSupported'),
    module => {
        WebView = module
        announce()
    },
)
class EditorBoundary extends Component<
    { children: ReactNode },
    { failed: boolean }
> {
    state = { failed: false }
    static getDerivedStateFromError() {
        return { failed: true }
    }
    render() {
        return this.state.failed ? (
            <Text style={{ color: '#ffb473', padding: 16 }}>
                O editor não foi carregado. Feche este painel e tente novamente.
            </Text>
        ) : (
            this.props.children
        )
    }
}
function Editor({
    mode,
    close,
}: {
    mode: 'profiles' | 'video'
    close(): void
}) {
    const [owner] = useState(() => accountId())
    const [nonce] = useState(
        () => `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )
    const [html] = useState(() =>
        ProfileEditorHtml.replace(
            '/*BF_CONFIG*/',
            `window.__BF_ACCOUNT_ID=${JSON.stringify(owner)};window.__BF_NONCE=${JSON.stringify(nonce)};window.__BF_MODE=${JSON.stringify(mode)}`,
        ),
    )
    const [, refresh] = useState(0),
        [failure, setFailure] = useState('')
    const web = useRef<{ injectJavaScript(script: string): void } | null>(null)
    const mounted = useRef(true),
        processing = useRef(new Set<number>())
    useEffect(() => {
        const change = () => refresh(v => v + 1)
        listeners.add(change)
        mounted.current = true
        return () => {
            mounted.current = false
            listeners.delete(change)
        }
    }, [])
    async function message(event: { nativeEvent: { data: string } }) {
        if (!owner || !mounted.current) return
        let id: number | undefined
        try {
            const raw = event.nativeEvent.data
            if (typeof raw !== 'string' || raw.length > 14000000)
                throw Error('Mensagem inválida.')
            const data = JSON.parse(raw)
            if (
                data.nonce !== nonce ||
                !Number.isSafeInteger(data.id) ||
                data.id < 1 ||
                typeof data.action !== 'string' ||
                !data.params ||
                typeof data.params !== 'object' ||
                Array.isArray(data.params)
            )
                throw Error('Mensagem inválida.')
            id = data.id
            if (processing.current.has(id!)) return
            processing.current.add(id!)
            if (accountId() !== owner)
                throw Error('A conta mudou. Abra o editor novamente.')
            if (data.action === 'close') {
                close()
                return
            }
            const result = await handleEditorRequest(
                owner,
                data.action,
                data.params,
            )
            if (mounted.current)
                web.current?.injectJavaScript(
                    `window.ByaFluxBridge.resolve(${id},${JSON.stringify({ ok: true, data: result ?? null })});true;`,
                )
        } catch (error) {
            if (id && mounted.current)
                web.current?.injectJavaScript(
                    `window.ByaFluxBridge.resolve(${id},${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Falha no editor.' })});true;`,
                )
        } finally {
            if (id) processing.current.delete(id)
        }
    }
    if (!owner)
        return (
            <Text style={{ color: '#fff', padding: 20 }}>
                Entre na sua conta para abrir o editor.
            </Text>
        )
    if (!WebView || failure)
        return (
            <Text style={{ color: '#ffb473', padding: 20 }}>
                {failure ||
                    'O componente de páginas do Discord ainda não foi carregado. Abra uma página no navegador interno do Discord e tente novamente.'}
            </Text>
        )
    return createElement(WebView, {
        ref: web,
        source: { html },
        style: { flex: 1, backgroundColor: '#15161a' },
        originWhitelist: ['*'],
        javaScriptEnabled: true,
        domStorageEnabled: false,
        allowFileAccess: false,
        allowUniversalAccessFromFileURLs: false,
        mixedContentMode: 'never',
        thirdPartyCookiesEnabled: false,
        sharedCookiesEnabled: false,
        setSupportMultipleWindows: false,
        mediaPlaybackRequiresUserAction: true,
        onShouldStartLoadWithRequest: ({ url }: { url: string }) =>
            url === 'about:blank' || url.startsWith('data:text/html'),
        onMessage: (event: { nativeEvent: { data: string } }) => {
            void message(event)
        },
        onError: () => setFailure('Não foi possível carregar o editor local.'),
        onRenderProcessGone: () => {
            setFailure(
                'O editor de vídeo foi encerrado pelo Android. Tente um vídeo menor.',
            )
            return true
        },
    })
}
export function NativeProfileTools() {
    const [mode, setMode] = useState<'profiles' | 'video' | null>(null)
    return (
        <View style={{ padding: 16, gap: 10 }}>
            <Design.TableRowGroup title="Perfil do ByaFlux">
                <Design.TableRow
                    label="ProfilePreset"
                    subLabel="Salve ou carregue seu perfil. Escolha quais campos incluir."
                    onPress={() => setMode('profiles')}
                />
                <Design.TableRow
                    label="Vídeo para GIF"
                    subLabel="Recorte, arraste e transforme um trecho em avatar animado."
                    onPress={() => setMode('video')}
                />
            </Design.TableRowGroup>
            <Modal
                visible={mode !== null}
                animationType="slide"
                onRequestClose={() => setMode(null)}
            >
                <View
                    style={{
                        flex: 1,
                        backgroundColor: '#15161a',
                        paddingTop: 28,
                    }}
                >
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => setMode(null)}
                        style={{
                            padding: 16,
                            borderBottomWidth: 1,
                            borderColor: '#444',
                        }}
                    >
                        <Text style={{ color: '#ff9438', fontWeight: '700' }}>
                            Fechar editor
                        </Text>
                    </Pressable>
                    {mode && (
                        <EditorBoundary key={mode}>
                            <Editor
                                mode={mode}
                                close={() => {
                                    setMode(null)
                                    Alert.alert(
                                        'ByaFlux',
                                        'As alterações visuais estão no editor de perfil. Confira e toque em Salvar alterações. Status selecionados são aplicados ao carregar.',
                                    )
                                }}
                            />
                        </EditorBoundary>
                    )}
                </View>
            </Modal>
        </View>
    )
}
const patched = new WeakSet<object>()
for (const name of [
    'UserProfileSettings',
    'UserProfileSettingsScreen',
    'UserProfileEdit',
    'UserProfileEditor',
    'UserProfileEditorScreen',
    'ProfileEditorScreen',
]) {
    getModules(
        withName<Props>(name),
        module => {
            if (!module || typeof module !== 'object' || patched.has(module))
                return
            const target = module as Record<
                string,
                (...args: any[]) => ReactNode
            >
            for (const key of Object.keys(target)) {
                const fn = target[key]
                if (
                    typeof fn !== 'function' ||
                    (key !== 'default' && key !== name)
                )
                    continue
                patched.add(module)
                instead(target, key, function (args, original) {
                    const result = Reflect.apply(original, this, args)
                    const props = args[0] as Props | undefined
                    if (
                        props?.guildId ||
                        (props?.userId && props.userId !== accountId())
                    )
                        return result
                    return (
                        <View style={{ flex: 1 }}>
                            {result}
                            <EditorBoundary>
                                <NativeProfileTools />
                            </EditorBoundary>
                        </View>
                    )
                })
            }
        },
        { returnNamespace: true },
    )
}

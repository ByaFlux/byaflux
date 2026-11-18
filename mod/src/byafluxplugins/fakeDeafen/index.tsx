import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { MediaEngineStore, Menu, React } from "@webpack/common";

const MediaEngineActions = findByPropsLazy("toggleSelfMute");
const SelectedChannelStore = findStoreLazy("SelectedChannelStore");

let running = false;
let previousMute: boolean | undefined;
let previousDeafen: boolean | undefined;

function syncVoiceFlag(mode: "mute" | "deafen", desired: boolean) {
    const current = mode === "mute" ? MediaEngineStore.isSelfMute() : MediaEngineStore.isSelfDeaf();
    const toggle = () => mode === "mute" ? MediaEngineActions.toggleSelfMute() : MediaEngineActions.toggleSelfDeaf();
    if (current === desired) toggle();
    toggle();
}

function onModeChange(mode: "mute" | "deafen", enabled: boolean) {
    if (!running || !isInVoiceChannel()) return;
    if (mode === "mute") {
        if (enabled) previousMute = MediaEngineStore.isSelfMute();
        syncVoiceFlag(mode, enabled ? true : previousMute ?? false);
        if (!enabled) previousMute = undefined;
    } else {
        if (enabled) previousDeafen = MediaEngineStore.isSelfDeaf();
        syncVoiceFlag(mode, enabled ? true : previousDeafen ?? false);
        if (!enabled) previousDeafen = undefined;
    }
}



function KeybindRecorder({ setValue, option }: { setValue: (v: string) => void; option: { default?: string; }; }) {
    const [recording, setRecording] = React.useState(false);
    const [keybind, setKeybind] = React.useState(settings.store.keybind || "");

    React.useEffect(() => {
        if (!recording) return;

        function onKeyDown(e: KeyboardEvent) {
            e.preventDefault();
            e.stopPropagation();

            if (e.key === "Escape") {
                setRecording(false);
                return;
            }

            if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

            const parts: string[] = [];
            if (e.ctrlKey) parts.push("Ctrl");
            if (e.shiftKey) parts.push("Shift");
            if (e.altKey) parts.push("Alt");
            parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);

            const combo = parts.join("+");
            setKeybind(combo);
            setValue(combo);
            setRecording(false);
        }

        document.addEventListener("keydown", onKeyDown, true);
        return () => document.removeEventListener("keydown", onKeyDown, true);
    }, [recording]);

    return (
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
                onClick={() => setRecording(!recording)}
                style={{
                    padding: "8px 16px",
                    borderRadius: "4px",
                    border: "none",
                    background: recording ? "#ed4245" : "#5865f2",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 500,
                    fontSize: "14px",
                    minWidth: "180px"
                }}
            >
                {recording ? "Press a key combo..." : keybind || "Click to set keybind"}
            </button>
            {keybind && !recording && (
                <button
                    onClick={() => {
                        setKeybind("");
                        setValue("");
                    }}
                    style={{
                        padding: "8px 12px",
                        borderRadius: "4px",
                        border: "none",
                        background: "#4f545c",
                        color: "white",
                        cursor: "pointer",
                        fontSize: "14px"
                    }}
                >
                    Clear
                </button>
            )}
        </div>
    );
}



const settings = definePluginSettings({
    fakeMute: {
        type: OptionType.BOOLEAN,
        description: "Fake Mute: exibe o mute sem silenciar o microfone local.",
        default: false,
        onChange: value => onModeChange("mute", value)
    },
    fakeDeafen: {
        type: OptionType.BOOLEAN,
        description: "Fake Deafen: exibe o deafen sem interromper o áudio local.",
        default: false,
        onChange: value => onModeChange("deafen", value),
    },
    keybind: {
        type: OptionType.COMPONENT,
        description: "Keybind to toggle Fake Deafen",
        component: (props) => <KeybindRecorder {...props} />
    }
});



function isInVoiceChannel(): boolean {
    try {
        return !!SelectedChannelStore.getVoiceChannelId();
    } catch {
        return false;
    }
}

function toggleFakeMute() {
    if (isInVoiceChannel()) settings.store.fakeMute = !settings.store.fakeMute;
}

function toggleFakeDeafen() {
    if (isInVoiceChannel()) settings.store.fakeDeafen = !settings.store.fakeDeafen;
}

function parseKeybind(keybind: string) {
    if (!keybind) return null;

    const parts = keybind.split("+").map(p => p.trim());
    const key = parts.pop()!;
    const modifiers = {
        ctrl: parts.includes("Ctrl"),
        shift: parts.includes("Shift"),
        alt: parts.includes("Alt"),
    };

    return { key, ...modifiers };
}

function handleKeyDown(e: KeyboardEvent) {
    const kb = parseKeybind(settings.store.keybind);
    if (!kb) return;

    if (
        e.key.toLowerCase() === kb.key.toLowerCase() &&
        e.ctrlKey === kb.ctrl &&
        e.shiftKey === kb.shift &&
        e.altKey === kb.alt
    ) {
        e.preventDefault();
        if (!isInVoiceChannel()) return;
        toggleFakeDeafen();
    }
}



export default definePlugin({
    name: "FakeDeafen",
    description: "Fake Mute e Fake Deafen, com controles no menu de áudio e nas configurações.",
    authors: [{ id: 1449096170646536233n, name: "Block" }],
    settings,

    patches: [
        {
            find: ".setSelfMute(this.selfMute",
            replacement: [
                {
                    match: /(?<=\.setSelfMute\()([^(),]{1,160})(?=[,)])/g,
                    replace: "$self.isFakeMute()?false:($1)"
                },
                {
                    match: /(?<=\.setSelfDeafen\()([^(),]{1,160})(?=[,)])/g,
                    replace: "$self.isFakeDeafen()?false:($1)"
                }
            ]
        }
    ],

    contextMenus: {
        "audio-device-context"(children) {
            children.push(
                <Menu.MenuSeparator />,
                <Menu.MenuCheckboxItem
                    id="vc-fake-mute"
                    label="Fake Mute"
                    checked={settings.store.fakeMute}
                    disabled={!isInVoiceChannel()}
                    action={toggleFakeMute}
                />,
                <Menu.MenuCheckboxItem
                    id="vc-fake-deafen"
                    label="Fake Deafen"
                    checked={settings.store.fakeDeafen}
                    disabled={!isInVoiceChannel()}
                    action={toggleFakeDeafen}
                />
            );
        }
    },

    start() {
        settings.store.fakeMute = false;
        settings.store.fakeDeafen = false;
        previousMute = previousDeafen = undefined;
        running = true;
        document.addEventListener("keydown", handleKeyDown);
    },

    stop() {
        settings.store.fakeMute = false;
        settings.store.fakeDeafen = false;
        running = false;
        previousMute = previousDeafen = undefined;
        document.removeEventListener("keydown", handleKeyDown);
    },

    isFakeMute() {
        return running && settings.store.fakeMute;
    },

    isFakeDeafen() {
        return running && settings.store.fakeDeafen;
    }
});

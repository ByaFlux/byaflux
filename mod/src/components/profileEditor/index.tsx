/* ByaFlux. GPL-3.0-or-later. Profile editor patch anchors follow the existing Decor integration. */
import "@shared/profileStudio.css";
import { ProfilePresetPanel } from "./presets/Panel";
import { VideoGifPanel } from "./video/Panel";
import ErrorBoundary from "@components/ErrorBoundary";
import { addPatch } from "@api/PluginManager";
import {
  Modal,
  openModal,
  React,
  UserProfileSettingsStore,
  useStateFromStores,
} from "@webpack/common";
export function openProfilePresets() {
  openModal((props) => (
    <Modal {...props} size="lg" title="Presets de perfil">
      <div className="bf-studio bs-modal">
        <ErrorBoundary>
          <ProfilePresetPanel onLoaded={props.onClose} />
        </ErrorBoundary>
      </div>
    </Modal>
  ));
}
export function openVideoGif() {
  openModal((props) => (
    <Modal {...props} size="lg" title="Vídeo para GIF">
      <div className="bf-studio bs-modal">
        <ErrorBoundary>
          <VideoGifPanel onApplied={props.onClose} />
        </ErrorBoundary>
      </div>
    </Modal>
  ));
}
export const ProfileEditorTools = ErrorBoundary.wrap(
  function ProfileEditorTools({
    kind,
    disabled = false,
  }: {
    kind: "profiles" | "video";
    disabled?: boolean;
  }) {
    // The store can be absent while Discord lazily initializes the profile editor.
    const stores = UserProfileSettingsStore ? [UserProfileSettingsStore] : [];
    const guild = useStateFromStores(stores, () => UserProfileSettingsStore?.selectedGuildId);
    if (guild) return null;
    return (
      <section
        className="bf-studio bs-native-tools"
        aria-label={
          kind === "profiles" ? "Presets de perfil do ByaFlux" : "Conversor de vídeo para GIF do ByaFlux"
        }
      >
        <span className="bs-eyebrow">ByaFlux</span>
        <h3>{kind === "profiles" ? "Presets de perfil" : "Vídeo para GIF"}</h3>
        <p>
          {kind === "profiles"
            ? "Salve seu visual e escolha quais partes carregar de um conjunto."
            : "Escolha um vídeo, arraste o recorte e transforme seu trecho favorito em GIF."}
        </p>
        <div className="bs-actions">
          <button
            type="button"
            className="bs-primary"
            disabled={disabled}
            onClick={kind === "profiles" ? openProfilePresets : openVideoGif}
          >
            {kind === "profiles" ? "Salvar ou carregar conjunto" : "Criar avatar com vídeo"}
          </button>
        </div>
      </section>
    );
  },
  { noop: true },
);
export function profileEditorPatches() {
  return [
    {
      find: "PROFILE_SIDEBAR_ITEM_WYSIWYG,",
      replacement: {
        match: /(?<=#{intl::USER_SETTINGS_AVATAR_DECORATION}\)},"decoration"\),)/,
        replace: "$self.renderProfileTools(),",
      },
    },
    {
      find: "UserProfileModalV2EditingPanel",
      replacement: {
        match: /disabled:(\i\|\|\i),avatarErrorMessage:\i,avatarDecorationErrorMessage:\i\}\),/,
        replace: "$&$self.renderProfileTools($1),",
      },
    },
  ];
}

/** Core feature: independent from the plugin registry and its persisted enabled flags. */
export function renderProfileTools(disabled = false) {
  return <><ProfileEditorTools key="byaflux-profile-presets" kind="profiles" disabled={disabled}/><ProfileEditorTools key="byaflux-video-gif" kind="video" disabled={disabled}/></>;
}
let initialized = false;
export function initializeProfileEditor() {
  if (initialized) return;
  initialized = true;
  for (const patch of profileEditorPatches()) addPatch(patch, "ByaFlux.ProfileEditor", "Vencord.ProfileEditor");
}

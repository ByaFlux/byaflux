/* ByaFlux. GPL-3.0-or-later. */
import { FluxDispatcher, SettingsRouter, UserStore } from "@webpack/common";
import { MAX_GIF_BYTES } from "./encoder";
export async function useGifAvatar(blob: Blob, accountId: string) {
  if (blob.type !== "image/gif" || !blob.size || blob.size > MAX_GIF_BYTES)
    throw Error("Gere um GIF válido de até 8 MB antes de continuar.");
  const imageUri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(Error("Não foi possível ler o GIF."));
    reader.readAsDataURL(blob);
  });
  if (UserStore.getCurrentUser()?.id !== accountId)
    throw Error("A conta mudou. Abra o painel novamente.");
  SettingsRouter.openUserSettings("Profile Customization");
  await new Promise((resolve) => setTimeout(resolve, 150));
  if (UserStore.getCurrentUser()?.id !== accountId)
    throw Error("A conta mudou. Abra o painel novamente.");
  FluxDispatcher.dispatch({
    type: "PROFILE_CUSTOMIZATION_OPEN_PREVIEW_MODAL",
    pendingImage: {
      assetOrigin: "NEW_ASSET",
      imageUri,
      description: "ByaFlux VideoAvatar",
      originalMd5: null,
    },
    file: { type: "image/gif" },
    uploadType: "AVATAR",
    analyticsSource: "user settings user profile",
    isTryItOut: false,
  });
}

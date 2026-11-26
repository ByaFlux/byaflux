/* ByaFlux. GPL-3.0-or-later. */
import * as DataStore from "@api/DataStore";
import { getUserSettingLazy } from "@api/UserSettings";
import { getCurrentProfile } from "@equicordplugins/profileSets/utils/profile";
import { fetchUserProfile } from "@utils/discord";
import {
  FluxDispatcher,
  SettingsRouter,
  UserProfileSettingsStore,
  UserProfileStore,
  UserStore,
} from "@webpack/common";
import {
  Field,
  makeProfile,
  pendingProfile,
  profileKey,
  readProfiles,
  restoredStatus,
  SavedProfile,
  selectedData,
} from "./model";

const Status = getUserSettingLazy<string>("status", "status")!;
const CustomStatus = getUserSettingLazy<any>("status", "customStatus")!;
export function currentAccount() {
  return UserStore.getCurrentUser()?.id;
}
function assertAccount(id: string) {
  if (currentAccount() !== id) throw Error("A conta mudou. Abra o painel novamente.");
}
export async function captureProfile(accountId: string, name: string, fields: Field[]) {
  assertAccount(accountId);
  await fetchUserProfile(accountId, undefined, false);
  assertAccount(accountId);
  if (!UserProfileStore.getUserProfile(accountId))
    throw Error("Não foi possível carregar seu perfil do Discord.");
  const data = await getCurrentProfile(undefined, {
    includeAvatar: fields.includes("avatarDataUrl"),
    includeBanner: fields.includes("bannerDataUrl"),
    strictImages: true,
  });
  assertAccount(accountId);
  const profile = UserProfileStore.getUserProfile(accountId) as any;
  const pending = UserProfileSettingsStore.getPendingChanges() as any;
  const profileFrame =
    pending?.pendingProfileFrame !== undefined
      ? pending.pendingProfileFrame
      : (profile?.profileFrame ?? null);
  const preset = makeProfile(
    accountId,
    name,
    {
      ...data,
      primaryGuildId:
        UserStore.getCurrentUser()?.primaryGuild?.identityEnabled === false
          ? null
          : data.primaryGuildId,
      profileFrame,
      presence: Status.getSetting(),
    },
    fields,
  );
  await DataStore.update<SavedProfile[]>(profileKey(accountId), (stored) => [
    ...readProfiles(stored, accountId),
    preset,
  ]);
  return preset;
}
export async function loadProfiles(accountId: string) {
  return readProfiles(await DataStore.get(profileKey(accountId)), accountId);
}
export async function deleteProfile(accountId: string, id: string) {
  assertAccount(accountId);
  await DataStore.update<SavedProfile[]>(profileKey(accountId), (stored) =>
    readProfiles(stored, accountId).filter((p) => p.id !== id),
  );
}
export async function renameProfile(accountId: string, id: string, name: string) {
  assertAccount(accountId);
  name = name.trim();
  if (!name || name.length > 64) throw Error("Use um nome de até 64 caracteres.");
  await DataStore.update<SavedProfile[]>(profileKey(accountId), (stored) =>
    readProfiles(stored, accountId).map((p) => (p.id === id ? { ...p, name } : p)),
  );
}
export async function applyProfile(preset: SavedProfile, fields: Field[]) {
  assertAccount(preset.accountId);
  const data = selectedData(preset, fields);
  if (!Object.keys(data).length) throw Error("Selecione pelo menos um campo para carregar.");
  const pending = pendingProfile(data);
  if (Object.keys(pending).length) {
    const unsaved = UserProfileSettingsStore.getPendingChanges() ?? {};
    if (Object.values(unsaved).some((value) => value !== undefined))
      throw Error(
        "Salve ou descarte suas alterações atuais no editor do Discord antes de carregar um perfil.",
      );
    SettingsRouter.openUserSettings("Profile Customization");
    await new Promise((resolve) => setTimeout(resolve, 150));
    assertAccount(preset.accountId);
    FluxDispatcher.dispatch({ type: "USER_PROFILE_SETTINGS_SET_PENDING_CHANGES", ...pending });
  }
  if (Object.hasOwn(data, "customStatus")) {
    assertAccount(preset.accountId);
    await CustomStatus.updateSetting(restoredStatus(preset));
  }
  if (Object.hasOwn(data, "presence")) {
    assertAccount(preset.accountId);
    if (["online", "idle", "dnd", "invisible"].includes(data.presence))
      await Status.updateSetting(data.presence);
  }
}

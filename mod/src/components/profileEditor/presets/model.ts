/* ByaFlux. GPL-3.0-or-later. */
export const FIELDS = [
  ["avatarDataUrl", "Foto de perfil", "Imagem estática ou animada"],
  ["bannerDataUrl", "Banner", "Imagem e animação do banner"],
  ["globalName", "Nome de exibição", "Nome mostrado no perfil"],
  ["bio", "Sobre mim", "Texto, links e emojis da bio"],
  ["pronouns", "Pronomes", "Pronomes do perfil"],
  ["themeColors", "Cores do perfil", "Cores principal e de destaque"],
  ["accentColor", "Cor do banner", "Cor sólida de fundo"],
  ["avatarDecoration", "Decoração do avatar", "Decoração equipada"],
  ["profileEffect", "Efeito de perfil", "Efeito animado equipado"],
  ["nameplate", "Nameplate", "Placa de nome equipada"],
  ["profileFrame", "Moldura do perfil", "Moldura equipada, quando disponível"],
  ["displayNameStyles", "Estilo do nome", "Fonte, efeito e cores do nome"],
  ["customStatus", "Status personalizado", "Texto, emoji e duração"],
  ["presence", "Disponibilidade", "Online, ausente, ocupado ou invisível"],
  ["primaryGuildId", "Tag de servidor", "Tag exibida ao lado do nome"],
] as const;
export type Field = (typeof FIELDS)[number][0];
export type ProfileData = Partial<Record<Field, any>>;
export interface SavedProfile {
  id: string;
  accountId: string;
  name: string;
  savedAt: number;
  fields: Field[];
  data: ProfileData;
  statusDuration: number;
}
export const allFields = (): Field[] => FIELDS.map(([key]) => key);
export function profileKey(id: string) {
  if (!/^\d{17,20}$/.test(id)) throw Error("Entre na sua conta para continuar.");
  return `ByaFlux.ProfileThemes.v1:${id}`;
}
export function makeProfile(
  accountId: string,
  name: string,
  input: ProfileData,
  selected: readonly Field[],
  now = Date.now(),
): SavedProfile {
  profileKey(accountId);
  name = name.trim();
  if (!name || name.length > 64) throw Error("Dê um nome de até 64 caracteres ao perfil.");
  const fields = allFields().filter((key) => selected.includes(key) && input[key] !== undefined);
  if (!fields.length) throw Error("Selecione pelo menos um campo para salvar.");
  const data = Object.fromEntries(
    fields.map((key) => [key, JSON.parse(JSON.stringify(input[key]))]),
  );
  const expires = Number(data.customStatus?.expiresAtMs ?? 0);
  return {
    id: crypto.randomUUID(),
    accountId,
    name,
    savedAt: now,
    fields,
    data,
    statusDuration: Number.isFinite(expires) ? Math.max(0, expires - now) : 0,
  };
}
export function readProfiles(value: unknown, accountId: string): SavedProfile[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (p): p is SavedProfile =>
      !!p &&
      p.accountId === accountId &&
      typeof p.id === "string" &&
      typeof p.name === "string" &&
      Array.isArray(p.fields) &&
      p.fields.every((key: any) => allFields().includes(key)) &&
      p.data &&
      typeof p.data === "object",
  );
}
const pendingKeys: Partial<Record<Field, string>> = {
  avatarDataUrl: "pendingAvatar",
  bannerDataUrl: "pendingBanner",
  globalName: "pendingGlobalName",
  bio: "pendingBio",
  pronouns: "pendingPronouns",
  accentColor: "pendingAccentColor",
  themeColors: "pendingThemeColors",
  avatarDecoration: "pendingAvatarDecoration",
  profileEffect: "pendingProfileEffect",
  nameplate: "pendingNameplate",
  profileFrame: "pendingProfileFrame",
  displayNameStyles: "pendingDisplayNameStyles",
  primaryGuildId: "pendingPrimaryGuildId",
};
export function selectedData(preset: SavedProfile, selected: readonly Field[]): ProfileData {
  return Object.fromEntries(
    preset.fields
      .filter((key) => selected.includes(key) && Object.hasOwn(preset.data, key))
      .map((key) => [key, preset.data[key]]),
  );
}
export function pendingProfile(data: ProfileData): Record<string, unknown> {
  const pending: Record<string, unknown> = {};
  for (const key of allFields()) {
    if (!Object.hasOwn(data, key) || data[key] === undefined || !pendingKeys[key]) continue;
    let value = data[key];
    if (key === "bio" || key === "pronouns") value ??= "";
    if (key === "avatarDataUrl" || key === "bannerDataUrl") {
      if (
        value != null &&
        (typeof value !== "string" ||
          !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value))
      )
        throw Error("Uma imagem salva está inválida. Salve esse perfil novamente.");
      value =
        value === null
          ? null
          : { assetOrigin: "NEW_ASSET", imageUri: value, description: "ByaFlux ProfileThemes" };
    }
    pending[pendingKeys[key]!] = value;
  }
  return pending;
}
export function restoredStatus(preset: SavedProfile, now = Date.now()) {
  const status = preset.data.customStatus;
  return {
    text: status?.text ?? "",
    emojiId: status?.emojiId ?? "0",
    emojiName: status?.emojiName ?? "",
    expiresAtMs: preset.statusDuration > 0 ? String(now + preset.statusDuration) : "0",
  };
}

import React from "react";
export { React };
const account = "1227436212982251533",
    guild = "2227436212982251533",
    role = "3227436212982251533",
    bot = "4227436212982251533",
    real = "5227436212982251533";
const all = Object.freeze([
    { id: guild, name: "@everyone", position: 0 },
    { id: role, name: "Owner", position: 100, hoist: true, unicodeEmoji: "👑", color: 16746496 },
    { id: bot, name: "Integração", position: 50, color: 5635925, managed: true },
    { id: real, name: "Membro", position: 1, color: 10070709 }
]);
export const GuildRoleStore = { getSortedRoles: () => all };
export const GuildMemberStore = { getMember: () => ({ userId: account, roles: [real] }) };
export const GuildStore = { getGuild: () => ({ id: guild, name: "Servidor de testes" }) };
export const UserStore = { getCurrentUser: () => ({ id: account, username: "Haru" }) };
export const SelectedGuildStore = { getGuildId: () => guild };
export const ChannelStore = { getChannel: () => ({ guild_id: guild }) };
export const useStateFromStores = (_, fn) => fn();
export const Button = props => <button {...props} />;
export const Menu = { MenuGroup: () => null, MenuItem: () => null };
export const Modal = ({ children }) => <div>{children}</div>;
export const openModal = () => {};
export const definePluginSettings = () => ({
    withPrivateSettings() {
        return {
            store: new Proxy(JSON.parse(localStorage.getItem("fake-roles-settings") || "{}"), {
                set(target, key, value) {
                    target[key] = value;
                    localStorage.setItem("fake-roles-settings", JSON.stringify(target));
                    return true;
                }
            })
        };
    }
});
export default Object.assign(value => value, { wrap: Component => Component });
window.roleFixture = {
    account,
    guild,
    role,
    bot,
    real,
    realMember: () => GuildMemberStore.getMember()
};

export function a() {
    return (
        <div aria-label="Lista nativa de cargos">
            {GuildMemberStore.getMember().roles.map(id => (
                <span key={id}>{all.find(r => r.id === id).name}</span>
            ))}
        </div>
    );
}
export function b() {
    return (
        <article aria-label="Perfil nativo">
            <ARole />
        </article>
    );
}
const ARole = a;
export const waitFor = (keys, callback) => {
    const module = { UserProfileRoles: a, UserProfileBody: b };
    if (keys.every(key => key in module)) callback(module);
};
const nativeRows = Object.freeze([
    { type: "GROUP", id: role, count: 2 },
    { type: "MEMBER", user: { id: "6227436212982251533", username: "Alice" } },
    { type: "MEMBER", user: { id: "7227436212982251533", username: "Zoe" } },
    { type: "GROUP", id: "online", count: 1 },
    { type: "MEMBER", user: { id: account, username: "Haru" }, roles: [real] }
]);
const nativeProps = {
    rows: nativeRows,
    groups: [
        { id: role, count: 2 },
        { id: "online", count: 1 }
    ],
    version: 1
};
const memberListeners = new Set();
export const ChannelMemberStore = {
    getProps: () => nativeProps,
    getRows: () => nativeRows,
    emitChange() {
        for (const listener of memberListeners) listener();
    },
    addChangeListener(fn) {
        memberListeners.add(fn);
    },
    removeChangeListener(fn) {
        memberListeners.delete(fn);
    }
};
window.roleFixture.originalRows = () => nativeRows;
export const PresenceStore = { getStatus: () => "online" };

export function Checkbox({ value, onChange, disabled, children }) {
    return (
        <label>
            <span>{children}</span>
            <input
                type="checkbox"
                checked={value}
                disabled={disabled}
                onChange={e => onChange(e, e.target.checked)}
            />
        </label>
    );
}

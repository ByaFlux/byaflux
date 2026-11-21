import React from "react";
import { createRoot } from "react-dom/client";
import { b as NativeProfile, ChannelMemberStore } from "./fake-roles-shim";
import plugin, { RoleEditor } from "../../src/byafluxplugins/fakeRoles";
plugin.start();
window.fakeRolesPlugin = plugin;
const { account, guild } = window.roleFixture;
function Profile() {
    const props = plugin.useVisualProfile({
        member: window.roleFixture.realMember(),
        guildId: guild
    });
    return <div aria-label="Cargos no perfil">{props.member.roles.join(",")}</div>;
}
function Sidebar() {
    const rows = React.useSyncExternalStore(
        fn => {
            ChannelMemberStore.addChangeListener(fn);
            return () => ChannelMemberStore.removeChangeListener(fn);
        },
        () => ChannelMemberStore.getProps(guild).rows
    );
    return (
        <aside aria-label="Lista de membros">
            {rows.map(row =>
                row.type === "GROUP" ? (
                    <h3 key={row.id}>{row.id}</h3>
                ) : (
                    <div key={row.user.id}>{row.user.username}</div>
                )
            )}
        </aside>
    );
}
createRoot(document.getElementById("root")).render(
    <>
        <h1>FakeRoles</h1>
        <RoleEditor guildId={guild} userId={account} />
        <Profile />
        <NativeProfile userId={account} guildId={guild} />
        <Sidebar />
    </>
);

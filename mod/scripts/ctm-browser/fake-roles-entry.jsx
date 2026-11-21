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
function MessageAuthor() {
    const author = plugin.useMessageAppearance(
        { colorString: "#99aab5", colorStrings: null, iconRoleId: undefined },
        {
            message: { author: { id: account }, channel_id: guild },
            channel: { guild_id: guild }
        }
    );
    return (
        <div>
            <span aria-label="Autor da mensagem" style={{ color: author.colorString }}>
                Haru
            </span>
            <span aria-label="Ícone do cargo na mensagem">
                {author.iconRoleId === window.roleFixture.role ? "👑" : ""}
            </span>
        </div>
    );
}
function Sidebar() {
    const rows = React.useSyncExternalStore(
        fn => {
            ChannelMemberStore.addChangeListener(fn);
            return () => ChannelMemberStore.removeChangeListener(fn);
        },
        () => ChannelMemberStore.getProps(guild).rows
    );
    const snapshot = ChannelMemberStore.getProps(guild);
    const visibleRows = React.useMemo(() => rows, [snapshot.version]);
    return (
        <aside aria-label="Lista de membros">
            {visibleRows.map(row =>
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
        <MessageAuthor />
        <NativeProfile userId={account} guildId={guild} />
        <Sidebar />
    </>
);

import React from "react";
import {createRoot} from "react-dom/client";
import plugin,{RoleEditor} from "../../src/byafluxplugins/fakeRoles";
plugin.start();
window.fakeRolesPlugin=plugin;
const {account,guild}=window.roleFixture;
function Profile(){const props=plugin.useVisualProfile({member:window.roleFixture.realMember(),guildId:guild});return <div aria-label="Cargos no perfil">{props.member.roles.join(",")}</div>}
createRoot(document.getElementById("root")).render(<><h1>FakeRoles</h1><RoleEditor guildId={guild} userId={account}/><Profile/></>);

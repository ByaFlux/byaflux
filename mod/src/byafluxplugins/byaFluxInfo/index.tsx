import { BYAFLUX_ICON } from "@shared/byaflux";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "ByaFluxInfo",
    description: "Informações do ByaFlux e créditos das bases Equicord e Vencord.",
    authors: [],
    settingsAboutComponent: () => (
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <img src={BYAFLUX_ICON} width={64} height={64} alt="ByaFlux" />
            <div><h2>ByaFlux</h2><p>Seus plugins. Do seu jeito.</p>
                <p>Baseado em Equicord e Vencord. Licença GPL-3.0-or-later.</p>
                <p>Atualizações disponíveis nas configurações → ByaFlux → Updater.</p>
            </div>
        </div>
    )
});

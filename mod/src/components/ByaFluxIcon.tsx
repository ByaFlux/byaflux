import { BYAFLUX_ICON } from "@shared/byaflux";

export function ByaFluxSettingsIcon(props: { className?: string; }) {
    return <img src={BYAFLUX_ICON} width={20} height={20} className={props.className} alt="ByaFlux" />;
}

/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * ByaFlux project support buttons.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { Heart } from "@components/Heart";
import { OpenExternalIcon } from "@components/Icons";
import { BYAFLUX_DONATE_URL, BYAFLUX_DISCORD_URL } from "@shared/byafluxSupport";
import { showToast } from "@webpack/common";

function openProjectLink(url: string | null, unavailableMessage: string) {
    if (!url) return showToast({ text: unavailableMessage });
    VencordNative.native.openExternal(url);
}

export function DonateButtonComponent() {
    return (
        <Flex>
            <Button variant="none" size="medium" type="button"
                className="vc-donate-support-button" style={{ marginTop: "1em" }}
                onClick={() => openProjectLink(BYAFLUX_DONATE_URL, "O link de doação ainda não está disponível.")}>
                <Heart />Doar
            </Button>
            <Button variant="none" size="medium" type="button"
                className="vc-invite-support-button" style={{ marginTop: "1em" }}
                onClick={() => openProjectLink(BYAFLUX_DISCORD_URL, "O convite do Discord ainda não está disponível.")}>
                Discord<OpenExternalIcon className="vc-invite-link" />
            </Button>
        </Flex>
    );
}

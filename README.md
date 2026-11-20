# ByaFlux for Linux (dev-version)

Versão experimental baseada no ByaFlux Desktop 0.1.12. Requer Discord Desktop já instalado e Linux x86_64 ou ARM64.

Feche o Discord e execute:

```bash
mkdir -p ~/ByaFlux-Linux && cd ~/ByaFlux-Linux
curl -fL "https://github.com/ByaFlux/byaflux/releases/download/linux-dev-v0.1.12.1/ByaFluxInstallerCli-Linux-$(uname -m)" -o ByaFluxInstaller
chmod +x ByaFluxInstaller
./ByaFluxInstaller --install
```

Selecione o Discord no terminal. Se ocorrer erro de permissão, repita o último comando com `sudo`. Não abra uma sessão root antes de executar o instalador.

Para remover: `./ByaFluxInstaller --uninstall`.
Para indicar uma instalação manualmente: `./ByaFluxInstaller --install --location /caminho/para/Discord`.

Atualizações desta edição usam apenas o canal Linux dev. A instalação não altera a release estável do Windows. As configurações ficam em ByaFluxLinuxDev, separadas da edição estável.

Discord instalado normalmente é o alvo principal. Flatpak é experimental. Snap e clientes instalados em AppImages imutáveis não são suportados por este instalador. Caso use AppImage, utilize uma instalação extraída e gravável.

O catálogo de plugins atual do ByaFlux, Vencord e Equicord está incluído. Áudio, compartilhamento de tela, atalhos e integrações externas dependem do Discord e do ambiente Linux. Nem todas as funções foram verificadas em uma sessão real de Discord, X11 ou Wayland.

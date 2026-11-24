# ByaFlux

[English](README.en.md)

Personalização para o Discord no Windows e Linux.

## Instalar

1. [Baixe o instalador para Windows](https://github.com/ByaFlux/byaflux/releases/latest/download/ByaFluxInstaller.exe).
2. Feche completamente o Discord, inclusive o ícone perto do relógio.
3. Execute o instalador e selecione seu Discord.

### Linux

```sh
curl -fL https://github.com/ByaFlux/byaflux/releases/latest/download/ByaFluxInstallerCli-Linux-$(uname -m) -o ByaFluxInstaller
chmod +x ByaFluxInstaller
./ByaFluxInstaller --install
```

Se a pasta do Discord exigir permissão de administrador, use `sudo ./ByaFluxInstaller --install`.

[Android](https://github.com/ByaFlux/byaflux/releases/latest) · [Todos os downloads](https://github.com/ByaFlux/byaflux/releases/latest)

## Atualizar ou remover

Quando houver atualização, use **Atualizar e reiniciar** no Discord.
Para reparar ou remover, feche o Discord e abra o instalador novamente.
No Linux, use `./ByaFluxInstaller --uninstall` para remover.

## Requisitos

Discord instalado, conexão com a internet e Windows x64 ou Linux x86_64/ARM64.

## Créditos

Baseado em [Equicord](https://github.com/Equicord/Equicord), [Vencord](https://github.com/Vendicated/Vencord)
e [Equilotl](https://github.com/Equicord/Equilotl). Licenças: [cliente](mod/LICENSE) e [instalador](installer/LICENSE).
O ByaFlux é independente e não tem afiliação com o Discord.

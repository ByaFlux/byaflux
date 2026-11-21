# ByaFlux

[English](README.en.md)

Plugins e personalização para o aplicativo do Discord.

**[Baixar para Windows x64](https://github.com/ByaFlux/byaflux/releases/latest/download/ByaFluxInstaller.exe)**

## Requisitos

Windows x64 ou Linux x86_64/ARM64, Discord instalado e conexão com a internet.

## Instalação

1. Feche completamente o Discord, inclusive o ícone perto do relógio.
2. Abra o instalador, selecione seu Discord e clique em **Install**.
3. Abra o Discord e acesse **Configurações do usuário → ByaFlux**.

## Atualizar, reparar ou remover

Use **Atualizar e reiniciar** quando o aviso de nova versão aparecer.

No instalador, **Reinstall / Repair** repara a instalação e **Uninstall** remove o ByaFlux. Feche o Discord antes de usar essas opções.

## Créditos e licença

Baseado em [Equicord](https://github.com/Equicord/Equicord), [Vencord](https://github.com/Vendicated/Vencord) e [Equilotl](https://github.com/Equicord/Equilotl). Licenças: [mod](mod/LICENSE) e [instalador](installer/LICENSE).

ByaFlux não é um produto oficial do Discord.

## Linux

Feche o Discord e execute:

```bash
mkdir -p ~/ByaFlux && cd ~/ByaFlux
curl -fL "https://github.com/ByaFlux/byaflux/releases/latest/download/ByaFluxInstallerCli-Linux-$(uname -m)" -o ByaFluxInstaller
chmod +x ByaFluxInstaller
./ByaFluxInstaller --install
```

Se a instalação do Discord exigir permissão de administrador, execute `sudo ./ByaFluxInstaller --install`. Não execute o próprio Discord com sudo.

Para remover: `./ByaFluxInstaller --uninstall`.

A edição Linux usa a mesma versão estável e o mesmo atualizador do Windows. Para sair do antigo canal Linux dev, execute este instalador uma vez. Configurações e temas antigos são importados quando ainda não existem na pasta estável.

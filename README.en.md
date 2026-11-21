# ByaFlux

[Português](README.md)

Plugins and customization for the Discord desktop app.

**[Download for Windows x64](https://github.com/ByaFlux/byaflux/releases/latest/download/ByaFluxInstaller.exe)**

## Requirements

Windows x64, Discord installed, and an internet connection.

## Installation

1. Fully close Discord, including its system tray icon.
2. Open the installer, select your Discord installation, and click **Install**.
3. Open Discord and go to **User Settings → ByaFlux**.

## Update, repair, or uninstall

Click **Atualizar e reiniciar** (Update and restart) when the new-version banner appears.

In the installer, **Reinstall / Repair** repairs the installation and **Uninstall** removes ByaFlux. Close Discord before using either option.

## Credits and license

Based on [Equicord](https://github.com/Equicord/Equicord), [Vencord](https://github.com/Vendicated/Vencord), and [Equilotl](https://github.com/Equicord/Equilotl). Licenses: [mod](mod/LICENSE) and [installer](installer/LICENSE).

ByaFlux is not an official Discord product.

## Linux

Close Discord, then run:

```bash
mkdir -p ~/ByaFlux && cd ~/ByaFlux
curl -fL "https://github.com/ByaFlux/byaflux/releases/latest/download/ByaFluxInstallerCli-Linux-$(uname -m)" -o ByaFluxInstaller
chmod +x ByaFluxInstaller
./ByaFluxInstaller --install
```

If Discord is installed in a protected system directory, run `sudo ./ByaFluxInstaller --install`. Do not run Discord with sudo.

To uninstall: `./ByaFluxInstaller --uninstall`.

Linux uses the same stable release and updater as Windows. Run this installer once to leave the old Linux dev channel. Existing settings and themes are imported only when missing from the stable data directory.

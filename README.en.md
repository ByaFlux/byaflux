# ByaFlux

[Português](README.md)

Discord customization for Windows and Linux.

## Install

1. [Download the Windows installer](https://github.com/ByaFlux/byaflux/releases/latest/download/ByaFluxInstaller.exe).
2. Fully close Discord, including its system tray icon.
3. Run the installer and select your Discord installation.

### Linux

```sh
curl -fL https://github.com/ByaFlux/byaflux/releases/latest/download/ByaFluxInstallerCli-Linux-$(uname -m) -o ByaFluxInstaller
chmod +x ByaFluxInstaller
./ByaFluxInstaller --install
```

If the Discord directory requires administrator access, use `sudo ./ByaFluxInstaller --install`.

[Android](https://github.com/ByaFlux/byaflux/releases/latest) · [All downloads](https://github.com/ByaFlux/byaflux/releases/latest)

## Update or remove

When an update is available, choose **Update and restart** in Discord.
To repair or remove ByaFlux, close Discord and run the installer again.
On Linux, use `./ByaFluxInstaller --uninstall` to remove it.

## Requirements

Discord installed, an internet connection, and Windows x64 or Linux x86_64/ARM64.

## Credits

Based on [Equicord](https://github.com/Equicord/Equicord), [Vencord](https://github.com/Vendicated/Vencord)
and [Equilotl](https://github.com/Equicord/Equilotl). Licenses: [client](mod/LICENSE) and [installer](installer/LICENSE).
ByaFlux is independent and is not affiliated with Discord.

# ByaFlux

[Português](README.md)

Customize Discord on Windows, Linux and Android.

## Install

Download from the [official site](https://byaflux.discloud.dev) or [latest release](https://github.com/ByaFlux/byaflux/releases/latest).

- **Windows:** fully close Discord, run `ByaFluxInstaller.exe` and select your installation.
- **Android:** install the ByaFlux APK and follow its instructions to install the modified Discord app.
- **Linux:** fully close Discord and run:

```sh
curl -fL https://github.com/ByaFlux/byaflux/releases/latest/download/ByaFluxInstallerCli-Linux-$(uname -m) -o ByaFluxInstaller
chmod +x ByaFluxInstaller
./ByaFluxInstaller --install
```

Use `sudo ./ByaFluxInstaller --install` when Discord's installation directory requires administrator access.

## Update or remove

On desktop, use **Update and restart** when prompted. Reopen the installer to repair or remove ByaFlux.
On Linux, remove it with `./ByaFluxInstaller --uninstall`.

On Android, accept the update prompt, update the installer and reinstall modified Discord to apply the new bundle.

## Requirements

Internet access. Installed Discord on Windows x64 or Linux x86_64/ARM64. Android 9 or newer.
Nitro features and collectibles still require the corresponding account benefits.

[Donate](https://byaflux.discloud.dev/doar)

## Credits

Based on Equicord, Vencord, Equilotl and Valenced. Original project and dependency credits and licenses are preserved.

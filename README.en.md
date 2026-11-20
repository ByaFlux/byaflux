# ByaFlux for Linux (dev-version)

Experimental Linux build based on ByaFlux Desktop 0.1.12. Requires an existing Discord Desktop installation and x86_64 or ARM64 Linux.

Close Discord, then run:

```bash
mkdir -p ~/ByaFlux-Linux && cd ~/ByaFlux-Linux
curl -fL "https://github.com/ByaFlux/byaflux/releases/download/linux-dev-v0.1.12.1/ByaFluxInstallerCli-Linux-$(uname -m)" -o ByaFluxInstaller
chmod +x ByaFluxInstaller
./ByaFluxInstaller --install
```

Choose Discord in the terminal. If access is denied, repeat the last command with `sudo`. Do not start a root login shell.

Remove with `./ByaFluxInstaller --uninstall`. Custom location: `./ByaFluxInstaller --install --location /path/to/Discord`.

Updates stay on the Linux dev channel. Settings use ByaFluxLinuxDev, separate from stable ByaFlux settings. Regular Discord installations are the primary target. Flatpak support is experimental. Snap and read-only AppImages are unsupported. Extract an AppImage into a writable location before attempting installation.

The existing ByaFlux, Vencord and Equicord plugin catalog is included. Audio, screen sharing, shortcuts and external integrations still require testing on your Discord/Linux setup. Not every plugin feature has been verified in a live X11 or Wayland session.

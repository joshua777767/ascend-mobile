---
name: Playwright NixOS LD_LIBRARY_PATH
description: How to make Playwright/Chromium headless work on NixOS — the complete nix store lib paths and the pattern for injecting them.
---

Playwright's downloaded Chromium binary is a standard Linux ELF; NixOS doesn't expose libs at /usr/lib. Must set LD_LIBRARY_PATH manually from nix store paths, at the top of playwright.config.ts before defineConfig.

**Why:** NixOS doesn't use /usr/lib; packages from the Nix environment are in /nix/store/... but are NOT automatically added to LD_LIBRARY_PATH. apt-get is blocked. nix-build/nix-env --installed don't expose a profile lib dir.

**How to apply:** In playwright.config.ts, build a NIX_LIBS array of known store paths, join with ":", and set process.env.LD_LIBRARY_PATH before the export. Also switch mobile project from iPhone 13 (WebKit — not installed) to Pixel 5 (Chromium).

**Finding missing libs:** Use `ldd <chromium-binary>` with the current LD_LIBRARY_PATH — shows exactly which .so files are still missing. Then `nix eval --raw nixpkgs#<pkg>` (fast) to get the store path. For split outputs like pango.out, fontconfig.lib, mesa-libgbm, append the output suffix.

**Complete lib set (as of this session):**
- xorg: libX11-1.8.12, libXcomposite-0.4.6, libXdamage-1.1.6, libXext-1.3.6, libXfixes-6.0.1, libXrandr-1.5.4, libxcb-1.17.0, libXrender-0.9.12
- glib-2.84.3, nss-3.101.2, nspr-4.36, at-spi2-core-2.56.2
- pango-1.56.3 (pango.out), cairo-1.18.2, gtk+3-3.24.49, fontconfig-2.16.0-lib (fontconfig.lib)
- cups-2.4.11, alsa-lib-1.2.13, expat-2.7.1, dbus-1.14.10, freetype-2.13.3
- libdrm-2.4.124, libxkbcommon-1.8.1, mesa-25.0.7
- mesa-libgbm-25.0.1 (nixpkgs#libgbm — separate package)
- systemd-minimal-libs-257.6 (nixpkgs#udev — provides libudev.so.1)

**Note:** Hashes in store paths will change when nixpkgs is updated. Re-run ldd to find new missing libs.

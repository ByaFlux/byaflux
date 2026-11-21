//go:build linux && cli

package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func fakeResources(t *testing.T, directory string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Join(directory, "resources"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(directory, "resources", "app.asar"), []byte("original Discord fixture"), 0644); err != nil {
		t.Fatal(err)
	}
}

func TestLinuxDiscovery(t *testing.T) {
	root := t.TempDir()
	oldDirs, oldHome := DiscordDirs, Home
	defer func() { DiscordDirs, Home = oldDirs, oldHome }()
	Home = filepath.Join(root, "home")
	DiscordDirs = []string{filepath.Join(root, "apps")}
	original := filepath.Join(root, "real-discord")
	fakeResources(t, original)
	if err := os.MkdirAll(DiscordDirs[0], 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(original, filepath.Join(DiscordDirs[0], "discord")); err != nil {
		t.Fatal(err)
	}
	found := FindDiscords()
	if len(found) != 1 {
		t.Fatalf("Expected symlink discovery, got %d installs", len(found))
	}
	config := filepath.Join(Home, ".config", "discord")
	fakeResources(t, filepath.Join(config, "app-0.0.9"))
	fakeResources(t, filepath.Join(config, "app-0.0.10"))
	current := ParseDiscordNew(config, "stable", false)
	if current == nil || !strings.Contains(current.resourcesPath, "app-0.0.10") {
		t.Fatal("Newest Discord app version not selected")
	}
	flatpak := filepath.Join(root, "flatpak", "app", "com.discordapp.Discord")
	fakeResources(t, filepath.Join(flatpak, "current", "active", "files", "discord"))
	if value := ParseDiscord(flatpak, ""); value == nil || !value.isFlatpak {
		t.Fatal("Flatpak not detected")
	}
	if ParseDiscord(filepath.Join(root, "flatpak", "x"), "") != nil {
		t.Fatal("Invalid Flatpak path accepted")
	}
}

func TestStableLinuxRelease(t *testing.T) {
	for _, tag := range []string{"linux-dev-v0.1.13.1", "mobile-v0.2.6", "v0.1.14-preview"} {
		if validateStableRelease(GithubRelease{TagName: tag}) == nil {
			t.Fatalf("Accepted %s", tag)
		}
	}
	var stable GithubRelease
	if err := json.Unmarshal([]byte(`{"tag_name":"v0.1.14","assets":[{"name":"desktop.asar","size":100}]}`), &stable); err != nil {
		t.Fatal(err)
	}
	if err := validateStableRelease(stable); err != nil {
		t.Fatal(err)
	}
	stable.Prerelease = true
	if validateStableRelease(stable) == nil {
		t.Fatal("Accepted prerelease")
	}
	if !strings.Contains(GetInstallerDownloadLink(), "/releases/latest/download/ByaFluxInstallerCli-Linux-") {
		t.Fatal("Not using stable Linux installer")
	}
}

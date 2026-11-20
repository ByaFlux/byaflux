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

func TestLinuxReleaseIsolation(t *testing.T) {
	var releases []GithubRelease
	if err := json.Unmarshal([]byte(`[
        {"tag_name":"v9.0.0","assets":[{"name":"desktop.asar","size":100}]},
        {"tag_name":"mobile-v9.0.0","prerelease":true,"assets":[{"name":"desktop.asar","size":100}]},
        {"tag_name":"linux-dev-v0.1.12.9","draft":true,"prerelease":true,"assets":[{"name":"desktop.asar","size":100}]},
        {"tag_name":"linux-dev-v0.1.12.8","prerelease":true,"assets":[{"name":"desktop.asar","size":0}]},
        {"tag_name":"linux-dev-v0.1.12.1","prerelease":true,"assets":[{"name":"desktop.asar","size":100}]}
    ]`), &releases); err != nil {
		t.Fatal(err)
	}
	selected, err := selectLinuxRelease(releases)
	if err != nil || selected.TagName != "linux-dev-v0.1.12.1" {
		t.Fatalf("Wrong Linux release: %v, %v", selected, err)
	}
	if _, err := selectLinuxRelease(releases[:4]); err == nil {
		t.Fatal("Must not fall back to Windows or mobile")
	}
	InstallerLatestTag = "linux-dev-v0.1.12.1"
	if !strings.Contains(GetInstallerDownloadLink(), "/linux-dev-v0.1.12.1/ByaFluxInstallerCli-Linux-") {
		t.Fatal("Wrong installer update URL")
	}
	InstallerLatestTag = "v9.0.0"
	if GetInstallerDownloadLink() != "" {
		t.Fatal("Stable channel installer accepted")
	}
}

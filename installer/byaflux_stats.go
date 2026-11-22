package main

import (
	"bytes"
	"encoding/json"
	"equilotl/buildinfo"
	"net/http"
	"runtime"
	"time"
)

// Best effort after patching succeeds. Network failure must not fail installation.
func reportByaFluxInstall() {
	platform := map[string]string{"windows": "windows", "linux": "linux"}[runtime.GOOS]
	if platform == "" {
		return
	}
	body, err := json.Marshal(map[string]string{"platform": platform, "version": buildinfo.InstallerTag})
	if err != nil {
		return
	}
	client := &http.Client{Timeout: 2 * time.Second}
	response, err := client.Post("https://byaflux.discloud.dev/api/client/install", "application/json", bytes.NewReader(body))
	if err == nil {
		response.Body.Close()
	}
}

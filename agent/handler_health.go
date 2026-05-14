package agent

import (
	"encoding/json"
	"net/http"
)

type HealthHandler struct{ version string }

func NewHealthHandler(version string) *HealthHandler {
	return &HealthHandler{version: version}
}

func (h *HealthHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	body, err := json.Marshal(map[string]string{"status": "ok", "version": h.version})
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(body)
}

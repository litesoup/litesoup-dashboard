package agent

import (
	"encoding/json"
	"net/http"
)

type SitesHandler struct{ discoverer SiteDiscoverer }

func NewSitesHandler(d SiteDiscoverer) *SitesHandler {
	return &SitesHandler{discoverer: d}
}

func (h *SitesHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	sites, err := h.discoverer.DiscoverSites()
	if err != nil {
		http.Error(w, "failed to discover sites", http.StatusInternalServerError)
		return
	}
	if sites == nil {
		sites = []Site{}
	}
	body, err := json.Marshal(sites)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(body)
}

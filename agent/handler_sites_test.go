package agent_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	agent "github.com/litesoup/litesoup-dashboard/agent"
)

type stubSiteDiscoverer struct{ sites []agent.Site }

func (s *stubSiteDiscoverer) DiscoverSites() ([]agent.Site, error) { return s.sites, nil }

type errorSiteDiscoverer struct{}

func (e *errorSiteDiscoverer) DiscoverSites() ([]agent.Site, error) {
	return nil, fmt.Errorf("conf read error")
}

func TestSitesHandler(t *testing.T) {
	stub := &stubSiteDiscoverer{sites: []agent.Site{
		{Domain: "example.com", User: "alice", PHPVersion: "8.2", Tier: "small", TLSMode: "letsencrypt", Docroot: "/home/alice/webapps/example.com"},
	}}
	h := agent.NewSitesHandler(stub)
	req := httptest.NewRequest(http.MethodGet, "/sites", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected Content-Type=application/json, got %q", ct)
	}
	var got []agent.Site
	if err := json.NewDecoder(w.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Domain != "example.com" {
		t.Errorf("unexpected sites: %+v", got)
	}
}

func TestSitesHandlerEmptySlice(t *testing.T) {
	stub := &stubSiteDiscoverer{sites: nil}
	h := agent.NewSitesHandler(stub)
	req := httptest.NewRequest(http.MethodGet, "/sites", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	var got []agent.Site
	if err := json.NewDecoder(w.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if got == nil {
		t.Error("expected [] not null")
	}
}

func TestSitesHandler_DiscovererError(t *testing.T) {
	h := agent.NewSitesHandler(&errorSiteDiscoverer{})
	req := httptest.NewRequest(http.MethodGet, "/sites", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

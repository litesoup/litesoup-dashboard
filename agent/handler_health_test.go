package agent_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/litesoup/litesoup-dashboard/agent"
)

func TestHealthHandler(t *testing.T) {
	h := agent.NewHealthHandler("0.1.0")
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string]string
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	if resp["status"] != "ok" {
		t.Errorf("expected status=ok, got %q", resp["status"])
	}
	if resp["version"] != "0.1.0" {
		t.Errorf("expected version=0.1.0, got %q", resp["version"])
	}
}

func TestHealthHandler_AllMethodsReturnOK(t *testing.T) {
	// Method filtering is done by the router (server.go mux.Handle("GET /health", ...)).
	// The handler itself does not check the method.
	h := agent.NewHealthHandler("0.1.0")
	for _, method := range []string{http.MethodGet, http.MethodPost, http.MethodDelete} {
		req := httptest.NewRequest(method, "/health", nil)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("method %s: expected 200, got %d", method, w.Code)
		}
	}
}

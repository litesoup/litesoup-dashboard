package agent_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	agent "github.com/litesoup/litesoup-dashboard/agent"
)

type stubServiceChecker struct{ s agent.ServiceStatus }

func (s *stubServiceChecker) CheckServices() (agent.ServiceStatus, error) { return s.s, nil }

type errorServiceChecker struct{}

func (e *errorServiceChecker) CheckServices() (agent.ServiceStatus, error) {
	return agent.ServiceStatus{}, fmt.Errorf("systemctl unavailable")
}

func TestServicesHandler(t *testing.T) {
	stub := &stubServiceChecker{s: agent.ServiceStatus{
		Apache:    "active",
		MariaDB:   "active",
		Redis:     "active",
		Memcached: "inactive",
		PHPFPM:    map[string]string{"8.2": "active", "8.3": "inactive"},
	}}

	h := agent.NewServicesHandler(stub)
	req := httptest.NewRequest(http.MethodGet, "/services", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected Content-Type=application/json, got %q", ct)
	}
	var got agent.ServiceStatus
	if err := json.NewDecoder(w.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if got.Apache != "active" {
		t.Errorf("expected apache=active, got %q", got.Apache)
	}
	if got.PHPFPM["8.2"] != "active" {
		t.Errorf("expected php_fpm[8.2]=active, got %q", got.PHPFPM["8.2"])
	}
}

func TestServicesHandler_CheckerError(t *testing.T) {
	h := agent.NewServicesHandler(&errorServiceChecker{})
	req := httptest.NewRequest(http.MethodGet, "/services", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

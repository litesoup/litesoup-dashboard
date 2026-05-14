package agent_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	agent "github.com/litesoup/litesoup-dashboard/agent"
)

type stubMetricsReader struct{ m agent.Metrics }

func (s *stubMetricsReader) ReadMetrics() (agent.Metrics, error) { return s.m, nil }

func TestMetricsHandler(t *testing.T) {
	stub := &stubMetricsReader{m: agent.Metrics{
		CPUPercent:  17.5,
		RAMUsedMB:   6144,
		RAMTotalMB:  8000,
		DiskUsedGB:  20,
		DiskTotalGB: 100,
	}}

	h := agent.NewMetricsHandler(stub)
	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected Content-Type=application/json, got %q", ct)
	}
	var got agent.Metrics
	if err := json.NewDecoder(w.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if got.CPUPercent != 17.5 {
		t.Errorf("expected CPUPercent=17.5, got %f", got.CPUPercent)
	}
	if got.RAMTotalMB != 8000 {
		t.Errorf("expected RAMTotalMB=8000, got %d", got.RAMTotalMB)
	}
}

func TestMetricsHandler_ReaderError(t *testing.T) {
	h := agent.NewMetricsHandler(&errorMetricsReader{})
	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

type errorMetricsReader struct{}

func (e *errorMetricsReader) ReadMetrics() (agent.Metrics, error) {
	return agent.Metrics{}, fmt.Errorf("disk read error")
}

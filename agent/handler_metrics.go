package agent

import (
	"encoding/json"
	"net/http"
)

// MetricsReader is implemented by sys.go (real) and stubs in tests.
type MetricsReader interface {
	ReadMetrics() (Metrics, error)
}

type MetricsHandler struct{ reader MetricsReader }

func NewMetricsHandler(r MetricsReader) *MetricsHandler {
	return &MetricsHandler{reader: r}
}

func (h *MetricsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	m, err := h.reader.ReadMetrics()
	if err != nil {
		http.Error(w, "failed to read metrics", http.StatusInternalServerError)
		return
	}
	body, err := json.Marshal(m)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(body)
}

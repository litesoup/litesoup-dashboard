package agent

import (
	"encoding/json"
	"net/http"
)

// ServiceChecker is implemented by sys.go (real) and stubs in tests.
type ServiceChecker interface {
	CheckServices() (ServiceStatus, error)
}

type ServicesHandler struct{ checker ServiceChecker }

func NewServicesHandler(c ServiceChecker) *ServicesHandler {
	return &ServicesHandler{checker: c}
}

func (h *ServicesHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s, err := h.checker.CheckServices()
	if err != nil {
		http.Error(w, "failed to check services", http.StatusInternalServerError)
		return
	}
	body, err := json.Marshal(s)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(body)
}

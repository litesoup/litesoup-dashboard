//go:build linux

package agent

import "net/http"

// NewServer returns an http.Handler with all agent routes registered.
// Uses Go 1.22+ method+path routing.
func NewServer(version string) http.Handler {
	sys := &LinuxSystem{}
	disc := NewDiscoverer(
		"/etc/apache2/sites-enabled",
		"/etc/php/*/fpm/pool.d",
	)

	mux := http.NewServeMux()
	mux.Handle("GET /health", NewHealthHandler(version))
	mux.Handle("GET /metrics", NewMetricsHandler(sys))
	mux.Handle("GET /services", NewServicesHandler(sys))
	mux.Handle("GET /sites", NewSitesHandler(disc))
	mux.Handle("POST /exec", NewExecHandler(sys))
	return mux
}

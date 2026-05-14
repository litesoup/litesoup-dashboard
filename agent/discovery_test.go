package agent_test

import (
	"path/filepath"
	"runtime"
	"testing"

	agent "github.com/litesoup/litesoup-dashboard/agent"
)

func testdataDir() string {
	_, file, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(file), "testdata")
}

func TestDiscoverSites(t *testing.T) {
	d := agent.NewDiscoverer(
		filepath.Join(testdataDir(), "sites-enabled"),
		filepath.Join(testdataDir(), "pool.d"),
	)
	sites, err := d.DiscoverSites()
	if err != nil {
		t.Fatal(err)
	}
	if len(sites) != 1 {
		t.Fatalf("expected 1 site, got %d", len(sites))
	}
	s := sites[0]
	if s.Domain != "example.com" {
		t.Errorf("expected domain=example.com, got %q", s.Domain)
	}
	if s.User != "siteuser" {
		t.Errorf("expected user=siteuser, got %q", s.User)
	}
	if s.PHPVersion != "8.2" {
		t.Errorf("expected php_version=8.2, got %q", s.PHPVersion)
	}
	if s.Tier != "small" {
		t.Errorf("expected tier=small (pm.max_children=5), got %q", s.Tier)
	}
	if s.TLSMode != "letsencrypt" {
		t.Errorf("expected tls_mode=letsencrypt (SSL vhost present), got %q", s.TLSMode)
	}
	if s.Docroot != "/home/siteuser/webapps/example.com" {
		t.Errorf("unexpected docroot %q", s.Docroot)
	}
}

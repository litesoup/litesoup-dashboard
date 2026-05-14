package agent

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// Discoverer scans litesoup-managed Apache vhost confs and PHP-FPM pool confs
// to build the list of active sites. Reads files only — no database.
type Discoverer struct {
	vhostDir string
	poolDir  string
}

// SiteDiscoverer is implemented by Discoverer (real) and stubs in tests.
type SiteDiscoverer interface {
	DiscoverSites() ([]Site, error)
}

func NewDiscoverer(vhostDir, poolDir string) *Discoverer {
	return &Discoverer{vhostDir: vhostDir, poolDir: poolDir}
}

var (
	reServerName   = regexp.MustCompile(`(?i)^\s*ServerName\s+(\S+)`)
	reDocumentRoot = regexp.MustCompile(`(?i)^\s*DocumentRoot\s+(\S+)`)
	reSSLEngine    = regexp.MustCompile(`(?i)^\s*SSLEngine\s+on`)
	reMaxChildren  = regexp.MustCompile(`(?i)^\s*pm\.max_children\s*=\s*(\d+)`)
	rePoolName     = regexp.MustCompile(`litesoup-(\S+)-php(\d+\.\d+)\.conf$`)
)

func (d *Discoverer) DiscoverSites() ([]Site, error) {
	confs, err := filepath.Glob(filepath.Join(d.vhostDir, "litesoup-*.conf"))
	if err != nil {
		return nil, fmt.Errorf("glob vhost dir: %w", err)
	}

	var sites []Site
	for _, conf := range confs {
		site, err := d.parseSite(conf)
		if err != nil {
			continue
		}
		sites = append(sites, site)
	}
	return sites, nil
}

func (d *Discoverer) parseSite(vhostConf string) (Site, error) {
	f, err := os.Open(vhostConf)
	if err != nil {
		return Site{}, err
	}
	defer f.Close()

	var domain, docroot string
	hasSSL := false
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if m := reServerName.FindStringSubmatch(line); m != nil && domain == "" {
			domain = m[1]
		}
		if m := reDocumentRoot.FindStringSubmatch(line); m != nil && docroot == "" {
			docroot = m[1]
		}
		if reSSLEngine.MatchString(line) {
			hasSSL = true
		}
	}
	if err := scanner.Err(); err != nil {
		return Site{}, fmt.Errorf("scanning %s: %w", vhostConf, err)
	}
	if domain == "" {
		return Site{}, fmt.Errorf("no ServerName in %s", vhostConf)
	}

	// Infer site user from docroot: /home/<user>/webapps/<domain>
	parts := strings.Split(docroot, "/")
	var user string
	if len(parts) >= 3 && parts[1] == "home" {
		user = parts[2]
	}

	tlsMode := "none"
	if hasSSL {
		tlsMode = "letsencrypt"
	}

	phpVersion, tier := d.findPool(user)

	return Site{
		Domain:     domain,
		User:       user,
		PHPVersion: phpVersion,
		Tier:       tier,
		TLSMode:    tlsMode,
		Docroot:    docroot,
	}, nil
}

func (d *Discoverer) findPool(user string) (phpVersion, tier string) {
	pattern := filepath.Join(d.poolDir, fmt.Sprintf("litesoup-%s-php*.conf", user))
	confs, _ := filepath.Glob(pattern)
	if len(confs) == 0 {
		return "unknown", "unknown"
	}
	conf := confs[0]
	if m := rePoolName.FindStringSubmatch(filepath.Base(conf)); m != nil {
		phpVersion = m[2]
	}
	f, err := os.Open(conf)
	if err != nil {
		return phpVersion, "unknown"
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		if m := reMaxChildren.FindStringSubmatch(scanner.Text()); m != nil {
			switch m[1] {
			case "5":
				tier = "small"
			case "20":
				tier = "medium"
			case "50":
				tier = "large"
			default:
				tier = "custom"
			}
			return
		}
	}
	if err := scanner.Err(); err != nil {
		return phpVersion, "unknown"
	}
	return phpVersion, "unknown"
}

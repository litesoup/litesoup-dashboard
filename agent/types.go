package agent

// Metrics holds point-in-time system resource readings.
type Metrics struct {
	CPUPercent  float64 `json:"cpu_percent"`
	RAMUsedMB   uint64  `json:"ram_used_mb"`
	RAMTotalMB  uint64  `json:"ram_total_mb"`
	DiskUsedGB  uint64  `json:"disk_used_gb"`
	DiskTotalGB uint64  `json:"disk_total_gb"`
}

// Site represents one WordPress site discovered from litesoup conf files.
type Site struct {
	Domain     string `json:"domain"`
	User       string `json:"user"`
	PHPVersion string `json:"php_version"`
	Tier       string `json:"tier"`
	TLSMode    string `json:"tls_mode"`
	Docroot    string `json:"docroot"`
}

// ServiceStatus maps service names to their systemd active state.
type ServiceStatus struct {
	Apache    string            `json:"apache"`
	MariaDB   string            `json:"mariadb"`
	Redis     string            `json:"redis"`
	Memcached string            `json:"memcached"`
	PHPFPM    map[string]string `json:"php_fpm"` // e.g. {"8.2":"active","8.3":"inactive"}
}

// ExecRequest is the body of POST /exec.
type ExecRequest struct {
	Command string            `json:"command"` // e.g. "site.create"
	Params  map[string]string `json:"params"`
}

// ExecLine is one streamed line from POST /exec (newline-delimited JSON).
type ExecLine struct {
	Type string `json:"type"` // "output" | "done"
	Line string `json:"line,omitempty"`
	Code int    `json:"code,omitempty"`
}

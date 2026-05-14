//go:build !linux

package agent

import (
	"io"
	"strings"
)

// LinuxSystem stub for non-Linux development. Returns canned data.
type LinuxSystem struct{}

func (l *LinuxSystem) ReadMetrics() (Metrics, error) {
	return Metrics{
		CPUPercent:  12.5,
		RAMUsedMB:   2048,
		RAMTotalMB:  8192,
		DiskUsedGB:  20,
		DiskTotalGB: 100,
	}, nil
}

func (l *LinuxSystem) CheckServices() (ServiceStatus, error) {
	return ServiceStatus{
		Apache:    "active",
		MariaDB:   "active",
		Redis:     "active",
		Memcached: "active",
		PHPFPM:    map[string]string{"8.2": "active", "8.3": "active"},
	}, nil
}

func (l *LinuxSystem) Run(args []string) (io.ReadCloser, error) {
	output := "[INFO] (dev stub) would run: " + strings.Join(args, " ") + "\n"
	return io.NopCloser(strings.NewReader(output)), nil
}

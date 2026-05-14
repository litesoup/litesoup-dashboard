//go:build linux

package agent

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// LinuxSystem implements MetricsReader, ServiceChecker, and CommandRunner
// using /proc, systemctl, and os/exec. Only compiles on Linux.
type LinuxSystem struct{}

func (l *LinuxSystem) ReadMetrics() (Metrics, error) {
	cpu1, err := readCPUStat()
	if err != nil {
		return Metrics{}, err
	}
	time.Sleep(100 * time.Millisecond)
	cpu2, err := readCPUStat()
	if err != nil {
		return Metrics{}, err
	}

	idleDiff := cpu2.idle - cpu1.idle
	totalDiff := cpu2.total - cpu1.total
	var cpuPct float64
	if totalDiff > 0 {
		cpuPct = 100 * (1 - float64(idleDiff)/float64(totalDiff))
	}

	ram, err := readMemInfo()
	if err != nil {
		return Metrics{}, err
	}

	var stat syscall.Statfs_t
	if err := syscall.Statfs("/", &stat); err != nil {
		return Metrics{}, fmt.Errorf("statfs: %w", err)
	}
	total := stat.Blocks * uint64(stat.Bsize)
	free := stat.Bavail * uint64(stat.Bsize)
	used := total - free

	return Metrics{
		CPUPercent:  cpuPct,
		RAMUsedMB:   ram.usedMB,
		RAMTotalMB:  ram.totalMB,
		DiskUsedGB:  used / (1024 * 1024 * 1024),
		DiskTotalGB: total / (1024 * 1024 * 1024),
	}, nil
}

type cpuStat struct{ idle, total uint64 }

func readCPUStat() (cpuStat, error) {
	f, err := os.Open("/proc/stat")
	if err != nil {
		return cpuStat{}, err
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "cpu ") {
			continue
		}
		fields := strings.Fields(line)[1:]
		var vals []uint64
		for _, field := range fields {
			v, _ := strconv.ParseUint(field, 10, 64)
			vals = append(vals, v)
		}
		if len(vals) < 4 {
			return cpuStat{}, fmt.Errorf("unexpected /proc/stat format")
		}
		idle := vals[3]
		var total uint64
		for _, v := range vals {
			total += v
		}
		return cpuStat{idle: idle, total: total}, nil
	}
	if err := scanner.Err(); err != nil {
		return cpuStat{}, fmt.Errorf("reading /proc/stat: %w", err)
	}
	return cpuStat{}, fmt.Errorf("cpu line not found in /proc/stat")
}

type memInfo struct{ totalMB, usedMB uint64 }

func readMemInfo() (memInfo, error) {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return memInfo{}, err
	}
	defer f.Close()
	vals := map[string]uint64{}
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		parts := strings.Fields(scanner.Text())
		if len(parts) >= 2 {
			v, _ := strconv.ParseUint(parts[1], 10, 64)
			vals[strings.TrimSuffix(parts[0], ":")] = v
		}
	}
	if err := scanner.Err(); err != nil {
		return memInfo{}, fmt.Errorf("reading /proc/meminfo: %w", err)
	}
	totalKB := vals["MemTotal"]
	availKB := vals["MemAvailable"]
	return memInfo{
		totalMB: totalKB / 1024,
		usedMB:  (totalKB - availKB) / 1024,
	}, nil
}

func (l *LinuxSystem) CheckServices() (ServiceStatus, error) {
	check := func(name string) string {
		cmd := exec.Command("systemctl", "is-active", "--quiet", name)
		if cmd.Run() == nil {
			return "active"
		}
		return "inactive"
	}

	s := ServiceStatus{
		Apache:    check("apache2"),
		MariaDB:   check("mariadb"),
		Redis:     check("redis-server"),
		Memcached: check("memcached"),
		PHPFPM:    map[string]string{},
	}

	entries, _ := filepath.Glob("/etc/php/*/fpm")
	for _, e := range entries {
		parts := strings.Split(e, "/")
		if len(parts) >= 4 {
			ver := parts[3]
			s.PHPFPM[ver] = check("php" + ver + "-fpm")
		}
	}
	return s, nil
}

func (l *LinuxSystem) Run(args []string) (io.ReadCloser, error) {
	cmd := exec.Command(args[0], args[1:]...)
	cmd.Env = append(os.Environ(), "TERM=dumb")
	pr, pw, err := os.Pipe()
	if err != nil {
		return nil, err
	}
	cmd.Stdout = pw
	cmd.Stderr = pw
	if err := cmd.Start(); err != nil {
		pw.Close()
		pr.Close()
		return nil, err
	}
	go func() {
		cmd.Wait()
		pw.Close()
	}()
	return pr, nil
}

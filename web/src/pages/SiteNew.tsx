import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OutputDrawer } from "@/components/OutputDrawer";
import { useExecStream } from "@/lib/useExecStream";
import { ArrowLeft } from "lucide-react";

const PHP_VERSIONS = ["8.2", "8.3", "8.4"];
const TIERS = ["small", "medium", "large"];
const TLS_MODES = ["none", "self-signed", "letsencrypt"];

export default function SiteNew() {
  const { id: serverId } = useParams<{ id: string }>();
  const exec = useExecStream();

  const [form, setForm] = useState({
    domain: "",
    php_version: "8.2",
    tier: "small",
    tls_mode: "none",
    tls_email: "",
    git_repo: "",
    git_branch: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    exec.run(`Create ${form.domain}`, `/api/servers/${serverId}/sites`, form);
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/servers/${serverId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">New site</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                value={form.domain}
                onChange={(e) =>
                  setForm((p) => ({ ...p, domain: e.target.value }))
                }
                placeholder="example.com"
                required
              />
            </div>

            {[
              {
                key: "php_version" as const,
                label: "PHP version",
                options: PHP_VERSIONS,
              },
              { key: "tier" as const, label: "Pool tier", options: TIERS },
              {
                key: "tls_mode" as const,
                label: "TLS mode",
                options: TLS_MODES,
              },
            ].map(({ key, label, options }) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Select
                  value={form[key]}
                  onValueChange={(v) => setForm((p) => ({ ...p, [key]: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}

            {form.tls_mode === "letsencrypt" && (
              <div className="space-y-1">
                <Label htmlFor="tls_email">
                  Let's Encrypt email{" "}
                  <span className="text-muted-foreground text-xs">
                    (required for LE)
                  </span>
                </Label>
                <Input
                  id="tls_email"
                  type="email"
                  value={form.tls_email}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, tls_email: e.target.value }))
                  }
                  placeholder="admin@example.com"
                  required={form.tls_mode === "letsencrypt"}
                />
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="git_repo">
                GitHub repository{" "}
                <span className="text-muted-foreground text-xs">
                  (optional)
                </span>
              </Label>
              <Input
                id="git_repo"
                value={form.git_repo}
                onChange={(e) =>
                  setForm((p) => ({ ...p, git_repo: e.target.value }))
                }
                placeholder="github.com/org/repo"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="git_branch">
                Branch{" "}
                <span className="text-muted-foreground text-xs">
                  (optional)
                </span>
              </Label>
              <Input
                id="git_branch"
                value={form.git_branch}
                onChange={(e) =>
                  setForm((p) => ({ ...p, git_branch: e.target.value }))
                }
                placeholder="main"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={exec.exitCode === null && exec.open}
            >
              Create site
            </Button>
          </form>
        </CardContent>
      </Card>

      <OutputDrawer
        open={exec.open}
        onOpenChange={exec.setOpen}
        title={exec.title}
        lines={exec.lines}
        exitCode={exec.exitCode}
      />
    </div>
  );
}

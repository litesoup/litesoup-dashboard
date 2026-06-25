import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSite } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmModal } from "@/components/ConfirmModal";
import { OutputDrawer } from "@/components/OutputDrawer";
import { useExecStream } from "@/lib/useExecStream";
import { formatTs } from "@/lib/utils";
import { ArrowLeft, Trash2 } from "lucide-react";

const PHP_VERSIONS = ["8.2", "8.3", "8.4"];
const TIERS = ["small", "medium", "large"];
const TLS_MODES = ["none", "self-signed", "letsencrypt"];

export default function SiteDetail() {
  const { id: serverId, siteId } = useParams<{ id: string; siteId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const exec = useExecStream();

  const site = useQuery({
    queryKey: ["servers", serverId, "sites", siteId],
    queryFn: () => getSite(serverId!, siteId!),
  });

  const [deleteOpen, setDeleteOpen] = useState(false);

  if (site.isLoading)
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (!site.data)
    return <p className="text-destructive text-sm">Site not found.</p>;
  const s = site.data;

  function base() {
    return `/api/servers/${serverId}/sites/${siteId}`;
  }

  async function handleExec(
    title: string,
    path: string,
    body: Record<string, unknown>,
  ) {
    await exec.run(title, path, body);
    qc.invalidateQueries({ queryKey: ["servers", serverId, "sites"] });
  }

  async function handleDelete() {
    setDeleteOpen(false);
    await exec.run(`Delete ${s.domain}`, base(), {});
    navigate(`/servers/${serverId}`);
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/servers/${serverId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold font-mono">{s.domain}</h1>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <span className="text-muted-foreground">User</span>
            <span className="font-mono">{s.site_user}</span>
            {s.git_repo && (
              <>
                <span className="text-muted-foreground">Repository</span>
                <span className="font-mono text-xs break-all">
                  {s.git_repo}
                </span>
                <span className="text-muted-foreground">Branch</span>
                <span className="font-mono">{s.git_branch || "—"}</span>
              </>
            )}
          </div>

          {[
            {
              key: "php_version" as const,
              label: "PHP version",
              options: PHP_VERSIONS,
              action: "set-php",
              bodyKey: "php_version",
            },
            {
              key: "tier" as const,
              label: "Pool tier",
              options: TIERS,
              action: "set-tier",
              bodyKey: "tier",
            },
            {
              key: "tls_mode" as const,
              label: "TLS mode",
              options: TLS_MODES,
              action: "set-tls",
              bodyKey: "tls_mode",
            },
          ].map(({ key, label, options, action, bodyKey }) => (
            <div key={key} className="flex items-center gap-3">
              <Label className="w-28 shrink-0">{label}</Label>
              <Select
                defaultValue={s[key]}
                onValueChange={(v) => {
                  const payload: Record<string, string> = { [bodyKey]: v };
                  // Prompt for email when switching to letsencrypt TLS
                  if (action === "set-tls" && v === "letsencrypt") {
                    const email = window.prompt(
                      "Email address for Let's Encrypt certificate:",
                      "admin@",
                    );
                    if (!email) return; // cancelled
                    payload.tls_email = email;
                  }
                  handleExec(`Set ${label} → ${v}`, `${base()}/${action}`, payload);
                }}
              >
                <SelectTrigger className="w-40">
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
        </CardContent>
      </Card>

      {(s.wp_version != null || s.wp_scanned_at != null) && (
        <Card>
          <CardHeader>
            <CardTitle>WordPress</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <span className="text-muted-foreground">Version</span>
            <span>{s.wp_version ?? "—"}</span>
            <span className="text-muted-foreground">Plugin updates</span>
            <span>{s.plugins_need_update ?? 0}</span>
            <span className="text-muted-foreground">Theme updates</span>
            <span>{s.themes_need_update ?? 0}</span>
            <span className="text-muted-foreground">Last scanned</span>
            <span>{s.wp_scanned_at ? formatTs(s.wp_scanned_at) : "Never"}</span>
          </CardContent>
        </Card>
      )}

      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${s.domain}?`}
        description="This will remove the Apache vhost, PHP pool, and webroot. This cannot be undone."
        onConfirm={handleDelete}
        destructive
      />

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

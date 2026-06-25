import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  getServer,
  getServerMetrics,
  getServerServices,
  getServerSites,
  syncServer,
  wpScanUrl,
} from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { ServerStatusBadge } from "@/components/ServerStatusBadge";
import { OutputDrawer } from "@/components/OutputDrawer";
import { useExecStream } from "@/lib/useExecStream";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTs } from "@/lib/utils";
import type { Site } from "@/lib/types";
import { Plus, RefreshCw, ScanSearch } from "lucide-react";

const siteColumns: ColumnDef<Site>[] = [
  {
    accessorKey: "domain",
    header: "Domain",
    cell: ({ row }) => (
      <Link
        to={`/servers/${row.original.server_id}/sites/${row.original.id}`}
        className="font-medium hover:underline font-mono"
      >
        {row.original.domain}
      </Link>
    ),
  },
  { accessorKey: "site_user", header: "User" },
  { accessorKey: "php_version", header: "PHP" },
  { accessorKey: "tier", header: "Tier" },
  { accessorKey: "tls_mode", header: "TLS" },
  {
    accessorKey: "wp_version",
    header: "WP",
    cell: ({ row }) =>
      row.original.wp_version ? (
        <Badge variant="outline">{row.original.wp_version}</Badge>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      ),
  },
  {
    id: "wp_updates",
    header: "Updates",
    cell: ({ row }) => {
      const plugins = row.original.plugins_need_update ?? 0;
      const themes = row.original.themes_need_update ?? 0;
      if (plugins === 0 && themes === 0)
        return <span className="text-muted-foreground text-xs">—</span>;
      return (
        <div className="flex gap-1">
          {plugins > 0 && <Badge variant="destructive">{plugins}P</Badge>}
          {themes > 0 && <Badge variant="secondary">{themes}T</Badge>}
        </div>
      );
    },
  },
  {
    accessorKey: "synced_at",
    header: "Synced",
    cell: ({ row }) => formatTs(row.original.synced_at),
  },
];

export default function ServerDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const server = useQuery({
    queryKey: ["servers", id],
    queryFn: () => getServer(id!),
  });
  const metrics = useQuery({
    queryKey: ["servers", id, "metrics"],
    queryFn: () => getServerMetrics(id!),
  });
  const services = useQuery({
    queryKey: ["servers", id, "services"],
    queryFn: () => getServerServices(id!),
  });
  const sites = useQuery({
    queryKey: ["servers", id, "sites"],
    queryFn: () => getServerSites(id!),
  });

  const sync = useMutation({
    mutationFn: () => syncServer(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["servers", id, "sites"] });
      qc.invalidateQueries({ queryKey: ["servers", id] });
    },
  });

  const wpScan = useExecStream();

  if (server.isLoading)
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (!server.data)
    return <p className="text-destructive text-sm">Server not found.</p>;

  const s = server.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{s.name}</h1>
          <ServerStatusBadge status={s.status} />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${sync.isPending ? "animate-spin" : ""}`}
            />
            Sync
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await wpScan.run("WP Scan", wpScanUrl(id!), {});
              qc.invalidateQueries({ queryKey: ["servers", id, "sites"] });
            }}
            disabled={wpScan.open}
          >
            <ScanSearch className="h-4 w-4 mr-2" />
            Scan WP
          </Button>
          <Button asChild size="sm">
            <Link to={`/servers/${id}/sites/new`}>
              <Plus className="h-4 w-4 mr-2" />
              New site
            </Link>
          </Button>
        </div>
      </div>

      <p className="text-muted-foreground text-sm font-mono">{s.hostname}</p>

      {metrics.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "CPU", value: `${metrics.data.cpu_percent.toFixed(1)}%` },
            {
              label: "RAM",
              value: `${metrics.data.ram_used_mb} / ${metrics.data.ram_total_mb} MB`,
            },
            {
              label: "Disk",
              value: `${metrics.data.disk_used_gb} / ${metrics.data.disk_total_gb} GB`,
            },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {services.data && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Services</h2>
          <div className="flex flex-wrap gap-2">
            {[
              ["Apache", services.data.apache],
              ["MariaDB", services.data.mariadb],
              ["Redis", services.data.redis],
              ["Memcached", services.data.memcached],
              ...Object.entries(services.data.phpfpm).map(([v, s]) => [
                `PHP-FPM ${v}`,
                s,
              ]),
            ].map(([name, status]) => (
              <div
                key={name as string}
                className="flex items-center gap-1 text-sm"
              >
                <span>{name}</span>
                <Badge
                  variant={status === "active" ? "default" : "destructive"}
                >
                  {status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-2">Sites</h2>
        <DataTable
          columns={siteColumns}
          data={sites.data ?? []}
          emptyMessage="No sites found. Click Sync or create a new site."
        />
      </div>

      <OutputDrawer
        open={wpScan.open}
        onOpenChange={wpScan.setOpen}
        title={wpScan.title}
        lines={wpScan.lines}
        exitCode={wpScan.exitCode}
      />
    </div>
  );
}

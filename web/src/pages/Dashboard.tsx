import { useQueries, useQuery } from "@tanstack/react-query";
import { Server, Globe } from "lucide-react";
import { getActivity, getServerSites, getServers } from "@/lib/api";
import { StatsCard } from "@/components/StatsCard";
import { formatTs } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { ActivityLog } from "@/lib/types";

const statusVariant: Record<
  ActivityLog["status"],
  "default" | "secondary" | "destructive"
> = {
  success: "default",
  running: "secondary",
  pending: "secondary",
  failed: "destructive",
};

export default function Dashboard() {
  const servers = useQuery({ queryKey: ["servers"], queryFn: getServers });
  const activity = useQuery({ queryKey: ["activity"], queryFn: getActivity });
  const siteQueries = useQueries({
    queries: (servers.data ?? []).map((server) => ({
      queryKey: ["servers", server.id, "sites"],
      queryFn: () => getServerSites(server.id),
      enabled: !!servers.data,
    })),
  });

  const totalSites = siteQueries.reduce(
    (count, query) => count + (query.data?.length ?? 0),
    0,
  );
  const serverNames = new Map(
    (servers.data ?? []).map((server) => [server.id, server.name]),
  );
  const sitesReady =
    servers.isSuccess &&
    siteQueries.every((query) => query.isSuccess || query.isError);
  const totalSitesValue = servers.isError
    ? "—"
    : servers.data && sitesReady
      ? totalSites
      : "…";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <StatsCard
          label="Total Servers"
          value={servers.data?.length ?? "—"}
          icon={Server}
        />
        <StatsCard
          label="Total Sites"
          value={totalSitesValue}
          icon={Globe}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
        {activity.isError && (
          <p className="text-sm text-destructive">
            Unable to load recent activity.
          </p>
        )}
        {activity.isLoading && (
          <p className="text-muted-foreground text-sm">Loading…</p>
        )}
        {activity.data?.length === 0 && !activity.isLoading && (
          <p className="text-muted-foreground text-sm">No activity yet.</p>
        )}
        <div className="space-y-2">
          {(activity.data ?? []).slice(0, 10).map((log) => (
            <div
              key={log.id}
              className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm"
            >
              <Badge variant={statusVariant[log.status]}>{log.status}</Badge>
              <span className="font-mono">{log.action}</span>
              <span className="text-muted-foreground">
                {serverNames.get(log.server_id) ?? log.server_id}
              </span>
              <span className="text-muted-foreground">
                {log.actor}
              </span>
              <span className="text-muted-foreground ml-auto">
                {formatTs(log.started_at)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { getServers } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { ServerStatusBadge } from "@/components/ServerStatusBadge";
import { Button } from "@/components/ui/button";
import { formatTs } from "@/lib/utils";
import type { Server } from "@/lib/types";
import { Plus } from "lucide-react";

const columns: ColumnDef<Server>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <Link
        to={`/servers/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  { accessorKey: "hostname", header: "Hostname" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <ServerStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "added_at",
    header: "Added",
    cell: ({ row }) => formatTs(row.original.added_at),
  },
];

export default function Servers() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["servers"],
    queryFn: getServers,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Servers</h1>
        <Button asChild>
          <Link to="/servers/new">
            <Plus className="h-4 w-4 mr-2" />
            Connect server
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          data={data}
          emptyMessage="No servers connected yet."
        />
      )}
    </div>
  );
}

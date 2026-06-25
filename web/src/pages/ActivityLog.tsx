import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { getActivity, getServers } from "@/lib/api";
import type { ActivityLog } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTs, formatDuration } from "@/lib/utils";

const statusVariant: Record<
  ActivityLog["status"],
  "default" | "secondary" | "destructive"
> = {
  success: "default",
  running: "secondary",
  pending: "secondary",
  failed: "destructive",
};

const columns: ColumnDef<ActivityLog>[] = [
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={statusVariant[row.original.status]}>
        {row.original.status}
      </Badge>
    ),
    filterFn: "equals",
  },
  { accessorKey: "server_id", header: "Server", filterFn: "equals" },
  { accessorKey: "action", header: "Action" },
  { accessorKey: "actor", header: "Actor" },
  {
    accessorKey: "started_at",
    header: "Started",
    cell: ({ row }) => formatTs(row.original.started_at),
  },
  {
    id: "duration",
    header: "Duration",
    cell: ({ row }) =>
      formatDuration(row.original.started_at, row.original.finished_at),
  },
];

export default function ActivityLogPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["activity"],
    queryFn: getActivity,
  });
  const servers = useQuery({ queryKey: ["servers"], queryFn: getServers });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const table = useReactTable({
    data,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  function setFilter(id: string, value: string | undefined) {
    setColumnFilters((prev) => {
      const without = prev.filter((f) => f.id !== id);
      return value ? [...without, { id, value }] : without;
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Activity Log</h1>

      <div className="flex gap-3">
        <Select
          onValueChange={(v) =>
            setFilter("server_id", v === "all" ? undefined : v)
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All servers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All servers</SelectItem>
            {(servers.data ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          onValueChange={(v) =>
            setFilter("status", v === "all" ? undefined : v)
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(["pending", "running", "success", "failed"] as const).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableHead key={h.id}>
                      {h.isPlaceholder
                        ? null
                        : flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <React.Fragment key={row.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() =>
                        setExpandedId(
                          expandedId === row.original.id
                            ? null
                            : row.original.id,
                        )
                      }
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    {expandedId === row.original.id && row.original.output && (
                      <TableRow>
                        <TableCell
                          colSpan={columns.length}
                          className="bg-muted/30 p-4"
                        >
                          <pre className="text-xs font-mono whitespace-pre-wrap">
                            {row.original.output}
                          </pre>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No activity yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import type { Server } from "@/lib/types";

const variantMap: Record<
  Server["status"],
  "default" | "destructive" | "secondary"
> = {
  active: "default",
  offline: "destructive",
  unknown: "secondary",
};

interface Props {
  status: Server["status"];
}

export function ServerStatusBadge({ status }: Props) {
  return <Badge variant={variantMap[status]}>{status}</Badge>;
}

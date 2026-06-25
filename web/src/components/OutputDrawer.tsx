import { useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  lines: string[];
  exitCode: number | null;
}

export function OutputDrawer({
  open,
  onOpenChange,
  title,
  lines,
  exitCode,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const running = exitCode === null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[640px] sm:w-[640px] flex flex-col"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {title}
            {running && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {exitCode === 0 && <Badge>Success</Badge>}
            {exitCode !== null && exitCode !== 0 && (
              <Badge variant="destructive">Failed (exit {exitCode})</Badge>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Command output
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 mt-4">
          <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-all">
            {lines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            <div ref={bottomRef} />
          </pre>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

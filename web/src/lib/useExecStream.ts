import { useState, useCallback } from "react";
import { streamExec } from "@/lib/api";

export function useExecStream() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [title, setTitle] = useState("");

  const run = useCallback(
    async (drawerTitle: string, url: string, body: Record<string, unknown>) => {
      setTitle(drawerTitle);
      setLines([]);
      setExitCode(null);
      setOpen(true);
      try {
        for await (const event of streamExec(url, body)) {
          if (event.type === "output" && event.line !== undefined) {
            setLines((prev) => [...prev, event.line!]);
          }
          if (event.type === "done" && event.code !== undefined) {
            setExitCode(event.code);
          }
        }
      } catch (err) {
        setLines((prev) => [...prev, String(err)]);
        setExitCode(1);
      }
    },
    [],
  );

  return { open, setOpen, lines, exitCode, title, run };
}

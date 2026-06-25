import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { createServer } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ServerNew() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    hostname: "",
    ssh_user: "root",
    ssh_port: "22",
    ssh_key_path: "",
    agent_direct_url: "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createServer({
        name: form.name,
        hostname: form.hostname,
        ssh_user: form.ssh_user,
        ssh_port: Number(form.ssh_port),
        ssh_key_path: form.ssh_key_path,
        agent_direct_url: form.agent_direct_url || undefined,
      }),
    onSuccess: (server) => {
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      navigate(`/servers/${server.id}`);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "failed");
    },
  });

  function handleChange(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/servers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Connect server</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              mutation.mutate();
            }}
            className="space-y-4"
          >
            {error && (
              <div role="alert" className="text-sm text-destructive">
                {error}
              </div>
            )}

            {(
              [
                { key: "name", label: "Display name", placeholder: "sg9" },
                {
                  key: "hostname",
                  label: "Hostname",
                  placeholder: "sg9.example.org",
                },
                { key: "ssh_user", label: "SSH user", placeholder: "root" },
                { key: "ssh_port", label: "SSH port", placeholder: "22" },
                {
                  key: "ssh_key_path",
                  label: "SSH key path",
                  placeholder: "/home/user/.ssh/id_ed25519",
                },
                {
                  key: "agent_direct_url",
                  label: "Agent direct URL (optional)",
                  placeholder: "http://127.0.0.1:7777",
                },
              ] as const
            ).map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  value={form[key]}
                  onChange={handleChange(key)}
                  placeholder={placeholder}
                  required={key !== "agent_direct_url"}
                />
              </div>
            ))}

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Connecting…" : "Connect"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

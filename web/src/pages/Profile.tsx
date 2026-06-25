import { useState } from "react";
import { changePassword } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Profile() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    if (!current || !next || !confirm) {
      setErrorMsg("All fields are required.");
      return;
    }
    if (next !== confirm) {
      setErrorMsg("New passwords do not match.");
      return;
    }
    setStatus("loading");
    try {
      await changePassword(current, next);
      setStatus("ok");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to change password.",
      );
    }
  }

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Current password</Label>
              <Input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1">
              <Label>New password</Label>
              <Input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1">
              <Label>Confirm new password</Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {status === "ok" && (
              <p className="text-sm text-green-600">Password updated.</p>
            )}
            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
            <Button
              type="submit"
              disabled={status === "loading"}
              className="w-full"
            >
              {status === "loading" ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

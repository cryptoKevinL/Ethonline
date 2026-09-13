import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldX, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { endTeamSession, startGoogleVerification, verifyTeamMembership } from "@/lib/teamVerification";

interface StatusUpdate {
  id: string;
  title: string;
  body: string;
  created_by: string | null;
  created_at: string;
}

interface BuildLogEntry {
  id: string;
  source: string;
  title: string;
  status: string;
  url: string | null;
  created_at: string;
}

type PageState =
  | { kind: "loading" }
  | { kind: "rejected"; reason?: string }
  | { kind: "verified"; email?: string; updates: StatusUpdate[]; buildLog: BuildLogEntry[] };

const TeamStatus = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    const run = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate("/team/verify", { replace: true });
        return;
      }

      const result = await verifyTeamMembership();
      if (!result.verified) {
        setState({ kind: "rejected", reason: result.reason });
        return;
      }

      // Reads are gated by RLS on the server-stamped team_verified claim.
      const [updatesRes, buildRes] = await Promise.all([
        supabase.from("team_status_updates").select("*").order("created_at", { ascending: false }),
        supabase.from("team_build_log").select("*").order("created_at", { ascending: false }).limit(50),
      ]);

      setState({
        kind: "verified",
        email: result.email,
        updates: updatesRes.error ? [] : (updatesRes.data as StatusUpdate[]),
        buildLog: buildRes.error ? [] : (buildRes.data as BuildLogEntry[]),
      });
    };
    run();
  }, [navigate]);

  const handleSignOut = async () => {
    await endTeamSession();
    navigate("/team/verify", { replace: true });
  };

  const handleTryAnotherAccount = async () => {
    await endTeamSession();
    await startGoogleVerification();
  };

  if (state.kind === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
        <p className="text-muted-foreground">Verifying team membership...</p>
      </div>
    );
  }

  if (state.kind === "rejected") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50 px-6">
        <Card className="glass-card max-w-md w-full p-8 text-center">
          <ShieldX className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Not an AnvilStack account</h1>
          <p className="text-muted-foreground text-sm mb-6">
            This area is for the AnvilStack team. The Google account you connected isn't on the anvilstack.com
            Workspace.
          </p>
          <Button onClick={handleTryAnotherAccount} className="w-full mb-3">
            Try a different Google account
          </Button>
          <p className="text-xs text-muted-foreground">
            <Link to="/" className="underline hover:text-foreground">
              Back to the site
            </Link>
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
      <div className="container mx-auto px-6 py-10 max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">AnvilStack team status</h1>
            <p className="text-muted-foreground text-sm mt-1">Internal updates, build and log details.</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="default" className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Verified team{state.email ? ` - ${state.email}` : ""}
            </Badge>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-1" />
              Sign out
            </Button>
          </div>
        </div>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Status updates</h2>
          {state.updates.length === 0 ? (
            <Card className="glass-card p-6">
              <p className="text-muted-foreground text-sm">No updates posted yet.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {state.updates.map((u) => (
                <Card key={u.id} className="glass-card p-6">
                  <div className="flex items-baseline justify-between mb-2">
                    <h3 className="font-semibold">{u.title}</h3>
                    <span className="text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleString()}
                      {u.created_by ? ` - ${u.created_by}` : ""}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{u.body}</p>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Build &amp; log</h2>
          {state.buildLog.length === 0 ? (
            <Card className="glass-card p-6">
              <p className="text-muted-foreground text-sm">
                Nothing here yet. CI (GitHub Actions) and deploy (Vercel) status will show up in this feed -
                status and metadata only, never env vars or credentials.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {state.buildLog.map((entry) => (
                <Card key={entry.id} className="glass-card p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{entry.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.source} - {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={entry.status === "success" ? "default" : "destructive"}>{entry.status}</Badge>
                    {entry.url && (
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline text-muted-foreground hover:text-foreground"
                      >
                        View
                      </a>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default TeamStatus;

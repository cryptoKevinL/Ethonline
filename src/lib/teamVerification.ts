import { supabase } from "@/lib/supabase";

export interface TeamVerificationResult {
  verified: boolean;
  email?: string;
  reason?: string;
}

/**
 * Starts the Google OAuth flow. The Google connection is used purely as an
 * attestation of org membership: after redirect, the team-verify edge
 * function checks the Workspace `hd` claim server-side before anything is
 * granted. The `hd` query param below is only a login-hint for Google; it is
 * not trusted for the decision.
 */
export async function startGoogleVerification(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/team/status`,
      queryParams: { hd: "anvilstack.com" },
    },
  });
  if (error) throw error;
}

/** True when the current session's app_metadata carries the server-stamped flag. */
export function isTeamVerified(user: { app_metadata?: Record<string, unknown> } | null): boolean {
  return user?.app_metadata?.team_verified === true;
}

/**
 * Asks the edge function to verify the current session's Google identity
 * against the anvilstack.com Workspace domain. On success it refreshes the
 * session so the new app_metadata claim (team_verified) is in the JWT that
 * RLS sees.
 */
export async function verifyTeamMembership(): Promise<TeamVerificationResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return { verified: false, reason: "no-session" };

  const { data, error } = await supabase.functions.invoke("team-verify", { method: "POST" });
  if (error) {
    let reason = "verification-failed";
    try {
      // FunctionsHttpError carries the Response so we can read the body's reason.
      const body = await (error as { context?: Response }).context?.json();
      if (body?.reason) reason = body.reason;
    } catch {
      // keep default reason
    }
    return { verified: false, reason };
  }

  if (data?.verified) {
    await supabase.auth.refreshSession();
    return { verified: true, email: data.email };
  }
  return { verified: false, reason: data?.reason ?? "verification-failed" };
}

export async function endTeamSession(): Promise<void> {
  await supabase.auth.signOut();
}

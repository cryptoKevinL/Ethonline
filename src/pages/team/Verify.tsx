import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import { startGoogleVerification } from "@/lib/teamVerification";

const TeamVerify = () => {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const handleVerify = async () => {
    setError(null);
    setStarting(true);
    try {
      await startGoogleVerification();
      // Browser redirects to Google; nothing else to do here.
    } catch {
      setError("Could not start Google verification. Please try again.");
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50 px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="glass-card max-w-md w-full p-8 text-center">
          <ShieldCheck className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">AnvilStack team verification</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Connect with Google to prove you're on the AnvilStack team. We check that your Google account belongs to
            the anvilstack.com Workspace - that's all it's used for.
          </p>
          <Button onClick={handleVerify} disabled={starting} className="w-full">
            {starting ? "Redirecting to Google..." : "Verify with Google"}
          </Button>
          {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
          <p className="text-xs text-muted-foreground mt-6">
            <Link to="/" className="underline hover:text-foreground">
              Back to the site
            </Link>
          </p>
        </Card>
      </motion.div>
    </div>
  );
};

export default TeamVerify;

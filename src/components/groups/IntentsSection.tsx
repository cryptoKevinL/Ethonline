import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { IntentCard } from "./IntentCard";

interface Intent {
  intentId: string;
  sourceAmount: string;
  sourceCurrency: string;
  destAmount: string;
  destCurrency: string;
  sourceChain: string;
  destChain: string;
  status: string;
  timestamp: number;
  sender: string;
  recipient: string;
  solver: string;
  totalFees: string;
  senderToSolverHash: string;
  solverToReceiverHash: string;
  hasRealData: boolean;
  sourceChainId: number; // Add this
  destinationChainId: number; 
}

interface IntentsSectionProps {
  userIntents: Intent[];
  allUserIntents: Intent[];
  isLoadingIntents: boolean;
  showAllIntents: boolean;
  onRefresh: () => void;
  onToggleShowAll: () => void;
}

export function IntentsSection({ 
  userIntents, 
  allUserIntents,
  isLoadingIntents, 
  showAllIntents,
  onRefresh,
  onToggleShowAll
}: IntentsSectionProps) {
  const displayedIntents = showAllIntents ? userIntents : userIntents.slice(0, 3);

  if (userIntents.length === 0 && !isLoadingIntents) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold gradient-text">Cross-Chain Payment Flow</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoadingIntents}
          >
            {isLoadingIntents ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          {allUserIntents.length > 3 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleShowAll}
            >
              {showAllIntents ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Show All ({allUserIntents.length})
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {isLoadingIntents ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-muted-foreground">Loading payment flows...</span>
          </div>
        </div>
      ) : (
        <div className="grid gap-6">
          {displayedIntents.map((intent, index) => (
            <IntentCard key={intent.intentId || index} intent={intent} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
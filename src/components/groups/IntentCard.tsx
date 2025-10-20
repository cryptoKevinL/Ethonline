import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Receipt, ArrowRight, Copy, ExternalLink, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProfileService } from "@/lib/profileService";
import { useState, useEffect } from "react";
import { getBlockscoutUrl } from "@/utils/extractIntentData";

// Helper function to get chain name for Supabase function
const getChainName = (chainId: number): string => {
  const chainMap: Record<number, string> = {
    11155111: 'eth-sepolia', // Ethereum Sepolia
    11155420: 'optimism-sepolia', // Optimism Sepolia
    84532: 'base-sepolia', // Base Sepolia
    80002: 'polygon-amoy', // Polygon Amoy
    421614: 'arbitrum-sepolia' // Arbitrum Sepolia
  };
  return chainMap[chainId] || 'optimism-sepolia';
};

// Helper function to search for transactions using Supabase function
const searchTransactionsWithSupabase = async (chainId: number, address: string, useInternal = false, action = 'txlist') => {
  const chainName = getChainName(chainId);
  const supabaseUrl = 'https://memgpowzdqeuwdpueajh.functions.supabase.co/blockscout';
  let url;
  
  if (useInternal) {
    // Use direct Blockscout v2 internal transactions API
    url = `https://${chainName}.blockscout.com/api/v2/addresses/${address}/internal-transactions`;
  } else if (action === 'tokentx') {
    url = `${supabaseUrl}?chain=${chainName}&address=${address}&api=v1&module=account&action=tokentx&page=1&offset=100`;
  } else {
    url = `${supabaseUrl}?chain=${chainName}&address=${address}&api=v1&page=1&offset=100`;
  }
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return null;
  }
};

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
  sourceChainId: number;
  destinationChainId: number;
}

interface IntentCardProps {
  intent: Intent;
  index: number;
}

export function IntentCard({ intent, index }: IntentCardProps) {
  const { toast } = useToast();
  const [paymentData, setPaymentData] = useState<any>(null);
  const [isLoadingPaymentData, setIsLoadingPaymentData] = useState(false);

  // Fetch payment data from database using intent ID
  useEffect(() => {
    const fetchPaymentData = async () => {
      if (!intent.intentId) return;
      
      setIsLoadingPaymentData(true);
      try {
        // Get payment data directly by intent ID
        const paymentResult = await ProfileService.getPaymentByIntentId(intent.intentId);
        if (paymentResult.success && paymentResult.data) {
          setPaymentData(paymentResult.data);
          console.log('Found payment data for intent', intent.intentId, ':', paymentResult.data);
        } else {
          console.log('No payment data found for intent', intent.intentId);
        }
      } catch (error) {
        console.error('Error fetching payment data for intent:', intent.intentId, error);
      } finally {
        setIsLoadingPaymentData(false);
      }
    };

    fetchPaymentData();
  }, [intent.intentId]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  return (
    <Card key={intent.intentId || index} className="glass-card p-6">
      <div className="space-y-6">
        {/* Intent Header with View Intent Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${
              intent.status === 'SUCCESS' ? 'bg-green-500/20' : 
              intent.status === 'PENDING' ? 'bg-yellow-500/20' : 'bg-blue-500/20'
            }`}>
              <Receipt className={`h-5 w-5 ${
                intent.status === 'SUCCESS' ? 'text-green-600' : 
                intent.status === 'PENDING' ? 'text-yellow-600' : 'text-blue-600'
              }`} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <p className="font-medium text-lg">Payment Intent #{intent.intentId}</p>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 px-3 text-xs bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-600 text-white"
                  onClick={() => window.open(`https://explorer.nexus-folly.availproject.org/intent/${intent.intentId}`, '_blank')}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View Intent
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {new Date(intent.timestamp * 1000).toLocaleDateString()} • {intent.sourceChain} → {intent.destChain}
                {paymentData && (
                  <span className="ml-2 text-xs text-green-600">✓ DB Data Loaded</span>
                )}
              </p>
            </div>
          </div>
          <div className="text-right">
            <Badge className={`text-sm ${
              intent.status === 'SUCCESS' ? 'bg-green-500/20 text-green-700' : 
              intent.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-700' : 
              'bg-blue-500/20 text-blue-700'
            }`}>
              {intent.status}
            </Badge>
            {intent.sourceAmount && (
              <p className="text-xs text-muted-foreground mt-1">
                Total: {intent.sourceAmount} {intent.sourceCurrency}
              </p>
            )}
          </div>
        </div>

        {/* Complete Payment Flow */}
        <div className="space-y-4">
          {/* Flow Header */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Step 1: Employer → Solver</span>
            <ArrowRight className="h-4 w-4" />
            <span>Step 2: Solver → Employer</span>
            <ArrowRight className="h-4 w-4" />
            <span>Step 3: Employer → Employee</span>
          </div>

          {/* Three-Step Flow */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Step 1: Employer → Solver */}
            <div className="flex flex-col">
              <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-200/50 h-full">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-blue-800">Step 1: Employer → Solver</h4>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700">
                    Deposit
                  </Badge>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">From Employer:</span>
                      {intent.sender ? (
                        <div className="flex items-center gap-1">
                          <p className="font-mono text-xs break-all">
                            {intent.sender.slice(0, 8)}...{intent.sender.slice(-6)}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4"
                            onClick={() => copyToClipboard(intent.sender, "Sender address")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Not available</p>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">To Solver:</span>
                      {(paymentData?.deposit_solver_address || intent.solver) ? (
                        <div className="flex items-center gap-1">
                          <p className="font-mono text-xs break-all">
                            {(paymentData?.deposit_solver_address || intent.solver).slice(0, 8)}...{(paymentData?.deposit_solver_address || intent.solver).slice(-6)}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4"
                            onClick={() => copyToClipboard(paymentData?.deposit_solver_address || intent.solver, "Solver address")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4"
                            onClick={() => window.open(
                              getBlockscoutUrl(intent.sourceChainId, intent.solver), 
                              '_blank'
                            )}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Not available</p>
                      )}
                    </div>
                  </div>
                  {intent.sourceAmount && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Amount Sent:</span>
                      <span className="font-semibold text-blue-700">
                        {intent.sourceAmount} {intent.sourceCurrency}
                      </span>
                    </div>
                  )}
                  {intent.sourceChain && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Source Chain:</span>
                      <span>{intent.sourceChain}</span>
                    </div>
                  )}
                  <div className="bg-blue-100/50 p-2 rounded text-xs">
                    <p className="text-blue-800 font-medium">Solver Action:</p>
                    <p className="text-blue-700">Receives {intent.sourceCurrency} from employer on {intent.sourceChain}</p>
                  </div>
                  {(paymentData?.first_tx_hash || intent.senderToSolverHash) && (
                    <div className="pt-2 border-t border-blue-200/50">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">Deposit TX:</span>
                        <Button
                          variant="default"
                          size="sm"
                          className="h-7 px-3 text-xs bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                          onClick={() => window.open(
                            getBlockscoutUrl(intent.sourceChainId, undefined, paymentData?.first_tx_hash || intent.senderToSolverHash), 
                            '_blank'
                          )}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View TX
                        </Button>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <p className="font-mono text-xs break-all">
                          {(paymentData?.first_tx_hash || intent.senderToSolverHash).slice(0, 10)}...{(paymentData?.first_tx_hash || intent.senderToSolverHash).slice(-8)}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4"
                          onClick={() => copyToClipboard(paymentData?.first_tx_hash || intent.senderToSolverHash, "Transaction hash")}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Step 2: Solver → Employer */}
            <div className="flex flex-col">
              <div className="p-4 bg-yellow-50/50 rounded-lg border border-yellow-200/50 h-full">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-yellow-800">Step 2: Solver → Employer</h4>
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-700">
                    Cross-chain
                  </Badge>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">From Solver:</span>
                      {intent.solver ? (
                        <div className="flex items-center gap-1">
                          <p className="font-mono text-xs break-all">
                            {intent.solver.slice(0, 8)}...{intent.solver.slice(-6)}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4"
                            onClick={() => copyToClipboard(intent.solver, "Solver address")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4"
                            onClick={() => window.open(
                              getBlockscoutUrl(intent.destinationChainId, intent.solver), 
                              '_blank'
                            )}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Not available</p>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">To Employer:</span>
                      {intent.sender ? (
                        <div className="flex items-center gap-1">
                          <p className="font-mono text-xs break-all">
                            {intent.sender.slice(0, 8)}...{intent.sender.slice(-6)}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4"
                            onClick={() => copyToClipboard(intent.sender, "Employer address")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {isLoadingPaymentData ? "Loading..." : "Not available"}
                        </p>
                      )}
                    </div>
                  </div>
                  {intent.destAmount && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Amount Received:</span>
                      <span className="font-semibold text-green-700">
                        {intent.destAmount} {intent.destCurrency}
                      </span>
                    </div>
                  )}
                  {intent.destChain && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Destination Chain:</span>
                      <span>{intent.destChain}</span>
                    </div>
                  )}
                  <div className="bg-yellow-100/50 p-2 rounded text-xs">
                    <p className="text-yellow-800 font-medium">Solver Action:</p>
                    <p className="text-yellow-700">Sends {intent.destCurrency} back to employer on {intent.destChain}</p>
                  </div>
                  {(paymentData?.solver_to_employer_hash || intent.solverToReceiverHash) && (
                    <div className="pt-2 border-t border-yellow-200/50">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">Solver TX:</span>
                        <Button
                          variant="default"
                          size="sm"
                          className="h-7 px-3 text-xs bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white"
                          onClick={async () => {
                            const txHash = paymentData?.solver_to_employer_hash || intent.solverToReceiverHash;
                            console.log('Step 2 TX Hash:', txHash, 'Length:', txHash?.length);
                            
                            // If we don't have the solver_to_employer_hash, search for it
                            if (!paymentData?.solver_to_employer_hash) {
                              console.log('🔍 Searching for solver → employer transaction...');
                              console.log('Solver address:', intent.solver);
                              console.log('Employer address:', intent.sender);
                              console.log('Destination chain ID:', intent.destinationChainId);
                              
                              try {
                                // Try regular transactions first
                                console.log('🔍 Searching regular transactions...');
                                const transactions = await searchTransactionsWithSupabase(intent.destinationChainId, intent.solver, false);
                                console.log('Solver transactions (regular):', transactions);
                                
                                let employerTx = null;
                                
                                if (transactions && transactions.result) {
                                  console.log('📊 Total regular transactions found:', transactions.result.length);
                                  
                                  // Find transaction where 'to' field matches employer address
                                  employerTx = transactions.result.find((tx: any) => 
                                    tx.to && tx.to.toLowerCase() === intent.sender.toLowerCase()
                                  );
                                  
                                  if (employerTx) {
                                    console.log('✅ Found solver → employer transaction (regular):', employerTx.hash);
                                  }
                                }
                                
                                // If not found in regular transactions, try internal transactions
                                if (!employerTx) {
                                  console.log('❌ No transaction found in regular transactions, trying internal transactions...');
                                  const internalTransactions = await searchTransactionsWithSupabase(intent.destinationChainId, intent.solver, true);
                                  console.log('Solver internal transactions:', internalTransactions);
                                  
                                  if (internalTransactions && internalTransactions.items) {
                                    console.log('📊 Total internal transactions found:', internalTransactions.items.length);
                                    
                                    // Just take the first (most recent) internal transaction
                                    employerTx = internalTransactions.items[0];
                                    
                                    if (employerTx) {
                                      console.log('✅ Found solver → employer transaction (internal):', employerTx.transaction_hash);
                                      // Update the hash to use the correct field
                                      employerTx.hash = employerTx.transaction_hash;
                                    } else {
                                      console.log('❌ No transaction found in internal transactions either');
                                      console.log('🔍 Available internal transactions:');
                                      internalTransactions.items.slice(0, 5).forEach((tx: any, index: number) => {
                                        console.log(`  ${index + 1}. From: ${tx.from?.hash}, To: ${tx.to?.hash}, Hash: ${tx.transaction_hash}`);
                                      });
                                    }
                                  }
                                }
                                
                                if (employerTx) {
                                  console.log('Full hash:', employerTx.hash);
                                  console.log('Hash length:', employerTx.hash.length);
                                  
                                  // Open the transaction
                                  window.open(
                                    getBlockscoutUrl(intent.destinationChainId, undefined, employerTx.hash), 
                                    '_blank'
                                  );
                                } else {
                                  console.log('💡 Possible issues:');
                                  console.log('  - Transaction not yet mined');
                                  console.log('  - Wrong solver address');
                                  console.log('  - Wrong employer address');
                                  console.log('  - Transaction on different chain');
                                  console.log('  - Transaction is neither regular nor internal');
                                }
                              } catch (error) {
                                console.error('Error searching for transactions:', error);
                              }
                            } else {
                              window.open(
                                getBlockscoutUrl(intent.destinationChainId, undefined, txHash), 
                                '_blank'
                              );
                            }
                          }}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View TX
                        </Button>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <p className="font-mono text-xs break-all">
                          {(paymentData?.solver_to_employer_hash || intent.solverToReceiverHash).slice(0, 10)}...{(paymentData?.solver_to_employer_hash || intent.solverToReceiverHash).slice(-8)}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4"
                          onClick={() => copyToClipboard(paymentData?.solver_to_employer_hash || intent.solverToReceiverHash, "Solver transaction hash")}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3: Employer → Employee */}
            <div className="flex flex-col">
              <div className="p-4 bg-green-50/50 rounded-lg border border-green-200/50 h-full">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-green-800">Step 3: Employer → Employee</h4>
                  <Badge variant="outline" className="bg-green-100 text-green-700">
                    {intent.status === 'SUCCESS' ? 'Completed' : 'Processing'}
                  </Badge>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">From Employer:</span>
                      {intent.sender ? (
                        <div className="flex items-center gap-1">
                          <p className="font-mono text-xs break-all">
                            {intent.sender.slice(0, 8)}...{intent.sender.slice(-6)}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4"
                            onClick={() => copyToClipboard(intent.sender, "Employer address")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Not available</p>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">To Employee:</span>
                      {paymentData?.recipient ? (
                        <div className="flex items-center gap-1">
                          <p className="font-mono text-xs break-all">
                            {paymentData.recipient.slice(0, 8)}...{paymentData.recipient.slice(-6)}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4"
                            onClick={() => copyToClipboard(paymentData.recipient, "Employee address")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : intent.recipient ? (
                        <div className="flex items-center gap-1">
                          <p className="font-mono text-xs break-all">
                            {intent.recipient.slice(0, 8)}...{intent.recipient.slice(-6)}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4"
                            onClick={() => copyToClipboard(intent.recipient, "Employee address")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {isLoadingPaymentData ? "Loading..." : "Not available"}
                        </p>
                      )}
                    </div>
                  </div>
                  {intent.destAmount && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Amount Sent:</span>
                      <span className="font-semibold text-green-700">
                        {intent.destAmount} {intent.destCurrency}
                      </span>
                    </div>
                  )}
                  {intent.destChain && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Destination Chain:</span>
                      <span>{intent.destChain}</span>
                    </div>
                  )}
                  <div className="bg-green-100/50 p-2 rounded text-xs">
                    <p className="text-green-800 font-medium">Employer Action:</p>
                    <p className="text-green-700">Sends {intent.destCurrency} directly to employee on {intent.destChain}</p>
                  </div>
                  {(paymentData?.tx_hash || intent.solverToReceiverHash) && (
                    <div className="pt-2 border-t border-green-200/50">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">Final TX:</span>
                        <Button
                          variant="default"
                          size="sm"
                          className="h-7 px-3 text-xs bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                          onClick={() => window.open(
                            getBlockscoutUrl(intent.destinationChainId, undefined, paymentData?.tx_hash || intent.solverToReceiverHash), 
                            '_blank'
                          )}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View TX
                        </Button>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <p className="font-mono text-xs break-all">
                          {(paymentData?.tx_hash || intent.solverToReceiverHash).slice(0, 10)}...{(paymentData?.tx_hash || intent.solverToReceiverHash).slice(-8)}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4"
                          onClick={() => copyToClipboard(paymentData?.tx_hash || intent.solverToReceiverHash, "Final transaction hash")}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Summary Footer */}
          {intent.totalFees && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-200/50">
              <div className="text-sm">
                <span className="text-muted-foreground">Total Fees: </span>
                <span className="font-semibold text-orange-600">
                  {intent.totalFees} {intent.sourceCurrency}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
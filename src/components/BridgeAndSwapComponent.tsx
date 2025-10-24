import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRightLeft, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Wallet,
  ExternalLink
} from 'lucide-react';
import { useNexus } from '@/providers/NexusProvider';
import { useToast } from '@/hooks/use-toast';
import { Contract, parseUnits, formatUnits, BrowserProvider } from 'ethers';
import { CONTRACT_ADDRESSES, SWAP_ABI, ERC20_ABI } from '@/lib/contracts';
import { useWalletClient, useSwitchChain } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import type { UserAsset } from '@avail-project/nexus-core';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Nexus SDK supported tokens
type Token = 'ETH' | 'USDC';
type Step = 'select' | 'bridging' | 'swapping' | 'complete' | 'error';

const CHAIN_NAMES: Record<number, string> = {
  84532: 'Base Sepolia',
  421614: 'Arbitrum Sepolia',
  11155420: 'Optimism Sepolia',
  80002: 'Polygon Amoy',
  11155111: 'Sepolia',
};

const CHAIN_LOGOS: Record<number, string> = {
  84532: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  421614: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  11155420: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  80002: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  11155111: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
};

interface BridgeProgress {
  step: Step;
  message: string;
  txHash?: string;
  explorerUrl?: string;
}

export function BridgeAndSwapComponent() {
  const { nexusSDK, isInitialized } = useNexus();
  const { toast } = useToast();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();

  const [selectedToken, setSelectedToken] = useState<Token>('USDC');
  const [unifiedBalances, setUnifiedBalances] = useState<UserAsset[] | undefined>(undefined);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<BridgeProgress>({
    step: 'select',
    message: ''
  });
  const [swapToPyusd, setSwapToPyusd] = useState(false);
  const [pyusdBalance, setPyusdBalance] = useState(0);

  // Fetch unified balances
  const fetchBalances = async () => {
    if (!nexusSDK || !isInitialized) return;
    
    setIsLoadingBalances(true);
    try {
      const balances = await nexusSDK.getUnifiedBalances();
      console.log('Unified Balances:', balances);
      
      // Filter for ETH, USDC (WETH not directly supported by bridge)
      const filtered = balances?.filter(token => 
        ['ETH', 'USDC'].includes(token.symbol) && 
        token.breakdown.some(chain => 
          [84532, 421614, 11155420, 80002, 11155111].includes(chain.chain.id)
        )
      ).map(token => ({
        ...token,
        breakdown: token.breakdown.filter(chain => 
          [84532, 421614, 11155420, 80002, 11155111].includes(chain.chain.id)
        )
      }));
      
      setUnifiedBalances(filtered);

      // Get PYUSD balance on Sepolia
      if (walletClient) {
        const provider = new BrowserProvider(walletClient as any);
        const signer = await provider.getSigner();
        const pyusdContract = new Contract(CONTRACT_ADDRESSES.PYUSD, ERC20_ABI, signer);
        const balance = await pyusdContract.balanceOf(await signer.getAddress());
        setPyusdBalance(parseFloat(formatUnits(balance, 6)));
      }
    } catch (error) {
      console.error('Error fetching balances:', error);
      toast({
        title: "Error",
        description: "Failed to fetch balances",
        variant: "destructive",
      });
    } finally {
      setIsLoadingBalances(false);
    }
  };

  useEffect(() => {
    if (isInitialized && nexusSDK) {
      fetchBalances();
    }
  }, [isInitialized, nexusSDK]);

  // Calculate total balance for selected token across all chains (excluding Sepolia)
  const getTotalBridgeable = () => {
    if (!unifiedBalances) return 0;
    
    const tokenData = unifiedBalances.find(t => t.symbol === selectedToken);
    if (!tokenData) return 0;

    // Sum balances from all chains except Sepolia, with gas buffer
    const totalBalance = tokenData.breakdown
      .filter(chain => chain.chain.id !== 11155111) // Exclude Sepolia
      .reduce((sum, chain) => sum + parseFloat(chain.balance), 0);

    // Reserve gas buffer per chain
    let gasBuffer = 0;
    if (selectedToken === 'ETH') {
      // Reserve 0.002 ETH per chain for gas
      const chainCount = tokenData.breakdown.filter(chain => 
        chain.chain.id !== 11155111 && parseFloat(chain.balance) > 0
      ).length;
      gasBuffer = 0.002 * chainCount;
    } else if (selectedToken === 'USDC') {
      // For USDC, we need ETH for gas on each chain
      // This is handled by the bridge itself, so we can be less conservative
      gasBuffer = 0;
    }

    // Return total minus gas buffer, minimum 0
    return Math.max(0, totalBalance - gasBuffer);
  };

  // Get source chains with balances (excluding Sepolia)
  const getSourceChains = () => {
    if (!unifiedBalances) return [];
    
    const tokenData = unifiedBalances.find(t => t.symbol === selectedToken);
    if (!tokenData) return [];

    return tokenData.breakdown
      .filter(chain => chain.chain.id !== 11155111 && parseFloat(chain.balance) > 0)
      .map(chain => chain.chain.id);
  };

  // Perform swap on Sepolia
  const performSwap = async (fromToken: 'ETH' | 'USDC', toToken: 'PYUSD', amount: number) => {
    if (!walletClient) {
      throw new Error('Wallet not connected');
    }

    try {
      setProgress({
        step: 'swapping',
        message: 'Switching to Sepolia network...'
      });

      // Switch to Sepolia
      const currentChainId = await walletClient.getChainId();
      if (currentChainId !== sepolia.id) {
        await switchChainAsync({ chainId: sepolia.id });
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      const provider = new BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();

      const swapContract = new Contract(CONTRACT_ADDRESSES.SWAP, SWAP_ABI, signer);

      setProgress({
        step: 'swapping',
        message: `Swapping ${amount.toFixed(4)} ${fromToken} to PYUSD...`
      });

      let tx;
      if (fromToken === 'ETH') {
        const swapAmount = parseUnits(amount.toString(), 18);
        tx = await swapContract.swapEthForPyusd({ value: swapAmount });
      } else if (fromToken === 'USDC') {
        const swapAmount = parseUnits(amount.toString(), 6);
        
        // Approve USDC first
        setProgress({
          step: 'swapping',
          message: 'Approving USDC...'
        });
        
        const usdcContract = new Contract(CONTRACT_ADDRESSES.USDC, ERC20_ABI, signer);
        const approveTx = await usdcContract.approve(CONTRACT_ADDRESSES.SWAP, swapAmount);
        await approveTx.wait();

        setProgress({
          step: 'swapping',
          message: `Swapping ${amount.toFixed(2)} USDC to PYUSD...`
        });

        tx = await swapContract.swapUsdcForPyusd(swapAmount);
      }

      if (tx) {
        const receipt = await tx.wait();
        return {
          success: true,
          txHash: receipt.hash
        };
      }

      return { success: false };
    } catch (error: any) {
      console.error('Swap error:', error);
      throw error;
    }
  };

  // Bridge and optionally swap
  const handleBridgeAndSwap = async () => {
    if (!nexusSDK || !isInitialized) {
      toast({
        title: "SDK Not Initialized",
        description: "Please wait for Nexus SDK to initialize",
        variant: "destructive",
      });
      return;
    }

    const totalBridgeable = getTotalBridgeable();
    if (totalBridgeable === 0) {
      toast({
        title: "No Balance",
        description: `No ${selectedToken} available to bridge from other chains`,
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Step 1: Bridge to Sepolia
      setProgress({
        step: 'bridging',
        message: `Bridging ${totalBridgeable.toFixed(4)} ${selectedToken} to Sepolia...`
      });

      const sourceChains = getSourceChains();
      console.log('Bridging from chains:', sourceChains);

      const bridgeResult = await nexusSDK.bridge({
        token: selectedToken,
        amount: totalBridgeable,
        chainId: 11155111, // Sepolia
        sourceChains: sourceChains
      });

      if (!bridgeResult.success) {
        throw new Error('Bridge failed');
      }

      toast({
        title: "✅ Bridge Successful!",
        description: `Bridged ${totalBridgeable.toFixed(4)} ${selectedToken} to Sepolia`,
      });

      // Wait a bit for balances to update
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 2: Swap to PYUSD if enabled
      if (swapToPyusd) {
        const swapResult = await performSwap(
          selectedToken as 'ETH' | 'USDC',
          'PYUSD',
          totalBridgeable
        );

        if (swapResult.success) {
          setProgress({
            step: 'complete',
            message: `Successfully bridged and swapped to PYUSD!`,
            txHash: swapResult.txHash
          });

          toast({
            title: "🎉 Complete!",
            description: `Bridged and swapped to PYUSD successfully`,
          });
        }
      } else {
        setProgress({
          step: 'complete',
          message: `Successfully bridged ${totalBridgeable.toFixed(4)} ${selectedToken} to Sepolia!`,
          explorerUrl: bridgeResult.explorerUrl
        });
      }

      // Refresh balances
      await fetchBalances();

      // Reset after 3 seconds
      setTimeout(() => {
        setProgress({ step: 'select', message: '' });
      }, 3000);

    } catch (error: any) {
      console.error('Bridge/Swap error:', error);
      
      setProgress({
        step: 'error',
        message: error.message || 'Operation failed'
      });

      toast({
        title: "❌ Operation Failed",
        description: error.message || "Failed to complete bridge/swap",
        variant: "destructive",
      });

      setTimeout(() => {
        setProgress({ step: 'select', message: '' });
      }, 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  // Get token breakdown for display
  const getTokenBreakdown = () => {
    if (!unifiedBalances) return [];
    
    const tokenData = unifiedBalances.find(t => t.symbol === selectedToken);
    if (!tokenData) return [];

    return tokenData.breakdown
      .filter(chain => parseFloat(chain.balance) > 0)
      .sort((a, b) => {
        // Sepolia first, then others
        if (a.chain.id === 11155111) return -1;
        if (b.chain.id === 11155111) return 1;
        return 0;
      });
  };

  const totalBridgeable = getTotalBridgeable();

  return (
    <Card className="glass-card p-6 hover-lift">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Bridge & Swap Assets
          </h3>
          <p className="text-sm text-muted-foreground">
            Bridge assets from all chains to Sepolia and optionally swap to PYUSD
          </p>
        </div>

        {/* Token Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Token</label>
          <Select value={selectedToken} onValueChange={(value) => setSelectedToken(value as Token)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USDC">USDC</SelectItem>
              <SelectItem value="ETH">ETH</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Balance Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Balance Breakdown</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchBalances}
              disabled={isLoadingBalances}
            >
              {isLoadingBalances ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Refresh'
              )}
            </Button>
          </div>

          {isLoadingBalances ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : getTokenBreakdown().length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No {selectedToken} balance found</p>
            </div>
          ) : (
            <div className="space-y-2 bg-secondary/30 rounded-lg p-3">
              {getTokenBreakdown().map((chain) => (
                <div
                  key={chain.chain.id}
                  className="flex items-center justify-between p-2 bg-background/50 rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
                      <img
                        src={CHAIN_LOGOS[chain.chain.id]}
                        alt={chain.chain.name}
                        className="w-4 h-4"
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {CHAIN_NAMES[chain.chain.id] || chain.chain.name}
                    </span>
                    {chain.chain.id === 11155111 && (
                      <Badge variant="secondary" className="text-xs">
                        Destination
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {parseFloat(chain.balance).toFixed(6)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ${chain.balanceInFiat.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

                  {/* Swap Toggle */}
        {totalBridgeable > 0 && (selectedToken === 'ETH' || selectedToken === 'USDC') && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src="https://assets.coingecko.com/coins/images/31212/small/PYUSD_Logo_%282%29.png"
                  alt="PYUSD"
                  className="w-6 h-6 rounded-full"
                />
                <div>
                  <p className="text-sm font-semibold text-purple-800">
                    Swap to PYUSD after bridge
                  </p>
                  <p className="text-xs text-purple-600">
                    Current PYUSD: {pyusdBalance.toFixed(2)}
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={swapToPyusd}
                  onChange={(e) => setSwapToPyusd(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
            {selectedToken === 'ETH' && totalBridgeable > 0 && (
              <div className="mt-2 text-xs text-purple-600 bg-purple-100 p-2 rounded">
                ℹ️ Note: Additional ETH will be reserved for swap gas on Sepolia
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        {totalBridgeable > 0 && (
          <div className="bg-gradient-to-r from-primary/10 to-blue-500/10 rounded-lg p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total to Bridge:</span>
                <span className="font-semibold">
                  {totalBridgeable.toFixed(6)} {selectedToken}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Destination:</span>
                <span className="font-semibold">Sepolia</span>
              </div>
              {swapToPyusd && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Final Token:</span>
                  <span className="font-semibold text-purple-700">PYUSD</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Button */}
        <Button
          onClick={handleBridgeAndSwap}
          disabled={isProcessing || totalBridgeable === 0 || !isInitialized}
          className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-blue-500 hover:opacity-90"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {progress.step === 'bridging' ? 'Bridging...' : 'Swapping...'}
            </>
          ) : totalBridgeable === 0 ? (
            'No Balance to Bridge'
          ) : swapToPyusd ? (
            <>
              <ArrowRightLeft className="mr-2 h-5 w-5" />
              Bridge & Swap to PYUSD
            </>
          ) : (
            <>
              <ArrowRightLeft className="mr-2 h-5 w-5" />
              Bridge to Sepolia
            </>
          )}
        </Button>

        {/* Progress Indicator */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  {progress.step === 'complete' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : progress.step === 'error' ? (
                    <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">
                      {progress.message}
                    </p>
                    {progress.explorerUrl && (
                      <a
                        href={progress.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                      >
                        View on Explorer
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Building2, Users, DollarSign, Calendar, Edit, Send, Loader2, CheckCircle, XCircle, AlertCircle, ArrowRightLeft } from "lucide-react";
import { useNexus } from "@/providers/NexusProvider";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Contract, parseUnits, formatUnits } from 'ethers';
import { CONTRACT_ADDRESSES, SWAP_ABI, ERC20_ABI } from '@/lib/contracts';
import { useWalletClient, useSwitchChain } from 'wagmi';
import { BrowserProvider } from 'ethers';
import { sepolia } from 'wagmi/chains';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  payment_amount: number;
  payment_frequency: string;
  chain: string;
  token: string;
  status: string;
  role: string;
  wallet_address: string;
  employment_id?: string;
}

interface Group {
  id: string;
  name: string;
  employees: number;
  totalPayment: string;
  totalPaymentUSDC: number;
  nextPayment: string;
  status: string;
  created_at?: string;
  employer?: {
    id: string;
    name: string;
    email: string;
  };
  employeeDetails?: Employee[];
}

interface GroupCardProps {
  group: Group;
  index: number;
  isProcessingPayment: string | null;
  formatTotalPayment: (group: Group) => string;
  onEdit: (groupId: string) => void;
  onPayAll: (group: Group) => void;
}

export function GroupCard({ 
  group, 
  index, 
  isProcessingPayment, 
  formatTotalPayment, 
  onEdit, 
  onPayAll 
}: GroupCardProps) {
  const validEmployees = group.employeeDetails?.filter(emp => 
    emp.wallet_address && 
    emp.wallet_address.trim() !== '' && 
    emp.payment_amount && 
    emp.payment_amount > 0
  ) || [];

  const { nexusSDK, isInitialized } = useNexus();
  const { toast } = useToast();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  
  const [hasEnoughBalance, setHasEnoughBalance] = useState(true);
  const [balanceCheck, setBalanceCheck] = useState<{
    required: Record<string, number>;
    available: Record<string, number>;
  }>({ required: {}, available: {} });
  const [isSwapping, setIsSwapping] = useState(false);
  const [payWithPyusd, setPayWithPyusd] = useState(false);
  const [pyusdBalance, setPyusdBalance] = useState(0);
  const [swapProgress, setSwapProgress] = useState<{
    isVisible: boolean;
    fromToken: string;
    toToken: string;
    fromAmount: string;
    toAmount: string;
    status: 'switching' | 'calculating' | 'approving' | 'swapping' | 'complete' | 'error';
    message: string;
    currentSwap: number;
    totalSwaps: number;
  }>({
    isVisible: false,
    fromToken: '',
    toToken: '',
    fromAmount: '',
    toAmount: '',
    status: 'calculating',
    message: '',
    currentSwap: 0,
    totalSwaps: 0
  });

  const checkBalances = async () => {
    if (!nexusSDK || !isInitialized) return;
    
    // Calculate base required amounts per token
    const requiredAmounts = validEmployees.reduce((acc, emp) => {
      const token = emp.token?.toUpperCase() || '';
      const amount = parseFloat(emp.payment_amount?.toString() || '0');
      acc[token] = (acc[token] || 0) + amount;
      return acc;
    }, {} as Record<string, number>);

    try {
      // Get unified balances
      const balances = await nexusSDK.getUnifiedBalances();
      
      // Calculate total available balance per token
      const availableAmounts = balances?.reduce((acc, token) => {
        acc[token.symbol] = parseFloat(token.balance);
        return acc;
      }, {} as Record<string, number>) || {};

      // Find PYUSD balance
      const pyusdBal = availableAmounts['PYUSD'] || 0;
      setPyusdBalance(pyusdBal);

      // Calculate differences and add buffers
      let sufficient = true;
      const finalRequiredAmounts: Record<string, number> = {};

      Object.entries(requiredAmounts).forEach(([token, amount]) => {
        const available = availableAmounts[token] || 0;
        const difference = Math.max(0, amount - available);
        
        // Add buffer to the difference
        const buffer = token === 'USDC' ? 3 : token === 'ETH' ? 0.001 : 0;
        const totalNeeded = difference > 0 ? difference + buffer : 0;
        
        finalRequiredAmounts[token] = totalNeeded;
        if (totalNeeded > 0) sufficient = false;
      });

      // Log the calculations for debugging
      console.log('Balance Check:', {
        required: requiredAmounts,
        available: availableAmounts,
        difference: finalRequiredAmounts,
        pyusdBalance: pyusdBal
      });

      // Store the amounts
      setHasEnoughBalance(sufficient);
      setBalanceCheck({
        required: finalRequiredAmounts,
        available: availableAmounts
      });
    } catch (error) {
      console.error('Error checking balances:', error);
      setHasEnoughBalance(false);
    }
  };

  const performSwap = async (fromToken: 'ETH' | 'USDC' | 'PYUSD', toToken: 'ETH' | 'USDC' | 'PYUSD', amountNeeded: number, currentSwap: number = 1, totalSwaps: number = 1) => {
    if (!walletClient) {
      throw new Error('Wallet not connected');
    }

    try {
      // Show swap progress immediately
      setSwapProgress({
        isVisible: true,
        fromToken,
        toToken,
        fromAmount: '0',
        toAmount: amountNeeded.toFixed(6),
        status: 'switching',
        message: totalSwaps > 1 ? 
          `Starting swap ${currentSwap} of ${totalSwaps}: Switching to Sepolia network...` :
          `Switching to Sepolia network...`,
        currentSwap,
        totalSwaps
      });

      // Step 1: Check current chain and switch to Sepolia if needed
      const currentChainId = await walletClient.getChainId();
      if (currentChainId !== sepolia.id) {
        try {
          await switchChainAsync({ chainId: sepolia.id });
          
          // Wait a bit for the chain switch to complete
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (switchError: any) {
          throw new Error(`Failed to switch to Sepolia: ${switchError.message}`);
        }
      }

      // Step 2: Create ethers provider and signer from wagmi walletClient
      const provider = new BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();

      // Verify we're on Sepolia
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== sepolia.id) {
        throw new Error('Not connected to Sepolia network');
      }

      const swapContract = new Contract(CONTRACT_ADDRESSES.SWAP, SWAP_ABI, signer);

      setSwapProgress(prev => ({
        ...prev,
        status: 'calculating',
        message: totalSwaps > 1 ? 
          `Swap ${currentSwap} of ${totalSwaps}: Calculating swap amount for ${amountNeeded.toFixed(4)} ${toToken}...` :
          `Calculating swap amount for ${amountNeeded.toFixed(4)} ${toToken}...`
      }));

      let swapAmount;
      let tx;

      if (fromToken === 'PYUSD' && toToken === 'ETH') {
        // Calculate how much PYUSD needed to get required ETH
        // Using the ratio: 2000 USDC/PYUSD = 1 ETH
        const pyusdNeeded = amountNeeded * 2000; // Convert ETH to PYUSD
        swapAmount = parseUnits(pyusdNeeded.toString(), 6);

        setSwapProgress(prev => ({
          ...prev,
          fromAmount: pyusdNeeded.toFixed(2),
          status: 'approving',
          message: totalSwaps > 1 ? 
            `Swap ${currentSwap} of ${totalSwaps}: Approving ${pyusdNeeded.toFixed(2)} PYUSD on Sepolia...` :
            `Approving ${pyusdNeeded.toFixed(2)} PYUSD on Sepolia...`
        }));

        // Approve PYUSD first
        const pyusdContract = new Contract(CONTRACT_ADDRESSES.PYUSD, ERC20_ABI, signer);
        const approveTx = await pyusdContract.approve(CONTRACT_ADDRESSES.SWAP, swapAmount);
        await approveTx.wait();

        setSwapProgress(prev => ({
          ...prev,
          status: 'swapping',
          message: totalSwaps > 1 ? 
            `Swap ${currentSwap} of ${totalSwaps}: Swapping ${pyusdNeeded.toFixed(2)} PYUSD for ${amountNeeded.toFixed(6)} ETH on Sepolia...` :
            `Swapping ${pyusdNeeded.toFixed(2)} PYUSD for ${amountNeeded.toFixed(6)} ETH on Sepolia...`
        }));

        // Execute swap: PYUSD -> ETH
        tx = await swapContract.swapPyusdForEth(swapAmount);

      } else if (fromToken === 'PYUSD' && toToken === 'USDC') {
        // PYUSD to USDC is 1:1
        const pyusdNeeded = amountNeeded;
        swapAmount = parseUnits(pyusdNeeded.toString(), 6);

        setSwapProgress(prev => ({
          ...prev,
          fromAmount: pyusdNeeded.toFixed(2),
          status: 'approving',
          message: totalSwaps > 1 ? 
            `Swap ${currentSwap} of ${totalSwaps}: Approving ${pyusdNeeded.toFixed(2)} PYUSD on Sepolia...` :
            `Approving ${pyusdNeeded.toFixed(2)} PYUSD on Sepolia...`
        }));

        // Approve PYUSD first
        const pyusdContract = new Contract(CONTRACT_ADDRESSES.PYUSD, ERC20_ABI, signer);
        const approveTx = await pyusdContract.approve(CONTRACT_ADDRESSES.SWAP, swapAmount);
        await approveTx.wait();

        setSwapProgress(prev => ({
          ...prev,
          status: 'swapping',
          message: totalSwaps > 1 ? 
            `Swap ${currentSwap} of ${totalSwaps}: Swapping ${pyusdNeeded.toFixed(2)} PYUSD for ${amountNeeded.toFixed(2)} USDC on Sepolia...` :
            `Swapping ${pyusdNeeded.toFixed(2)} PYUSD for ${amountNeeded.toFixed(2)} USDC on Sepolia...`
        }));

        // Execute swap: PYUSD -> USDC
        tx = await swapContract.swapPyusdForUsdc(swapAmount);

      } else if (fromToken === 'ETH' && toToken === 'USDC') {
        // Calculate how much ETH needed to get required USDC
        // Using the ratio: 2000 USDC = 1 ETH
        const ethNeeded = amountNeeded / 2000; // Convert USDC to ETH
        swapAmount = parseUnits(ethNeeded.toString(), 18);

        setSwapProgress(prev => ({
          ...prev,
          fromAmount: ethNeeded.toFixed(6),
          status: 'swapping',
          message: totalSwaps > 1 ? 
            `Swap ${currentSwap} of ${totalSwaps}: Swapping ${ethNeeded.toFixed(6)} ETH for ${amountNeeded.toFixed(2)} USDC on Sepolia...` :
            `Swapping ${ethNeeded.toFixed(6)} ETH for ${amountNeeded.toFixed(2)} USDC on Sepolia...`
        }));

        // Execute swap: ETH -> USDC
        tx = await swapContract.swapEthForUsdc({ value: swapAmount });
        
      } else if (fromToken === 'USDC' && toToken === 'ETH') {
        // Calculate how much USDC needed to get required ETH
        // Using the ratio: 2000 USDC = 1 ETH
        const usdcNeeded = amountNeeded * 2000; // Convert ETH to USDC
        swapAmount = parseUnits(usdcNeeded.toString(), 6);

        setSwapProgress(prev => ({
          ...prev,
          fromAmount: usdcNeeded.toFixed(2),
          status: 'approving',
          message: totalSwaps > 1 ? 
            `Swap ${currentSwap} of ${totalSwaps}: Approving ${usdcNeeded.toFixed(2)} USDC on Sepolia...` :
            `Approving ${usdcNeeded.toFixed(2)} USDC on Sepolia...`
        }));

        // Approve USDC first
        const usdcContract = new Contract(CONTRACT_ADDRESSES.USDC, ERC20_ABI, signer);
        const approveTx = await usdcContract.approve(CONTRACT_ADDRESSES.SWAP, swapAmount);
        await approveTx.wait();

        setSwapProgress(prev => ({
          ...prev,
          status: 'swapping',
          message: totalSwaps > 1 ? 
            `Swap ${currentSwap} of ${totalSwaps}: Swapping ${usdcNeeded.toFixed(2)} USDC for ${amountNeeded.toFixed(6)} ETH on Sepolia...` :
            `Swapping ${usdcNeeded.toFixed(2)} USDC for ${amountNeeded.toFixed(6)} ETH on Sepolia...`
        }));

        // Execute swap: USDC -> ETH
        tx = await swapContract.swapUsdcForEth(swapAmount);
      }

      if (tx) {
        await tx.wait();
        
        setSwapProgress(prev => ({
          ...prev,
          status: 'complete',
          message: totalSwaps > 1 ? 
            `✅ Swap ${currentSwap} of ${totalSwaps} successful on Sepolia! Got ${amountNeeded.toFixed(4)} ${toToken}` :
            `✅ Swap successful on Sepolia! Got ${amountNeeded.toFixed(4)} ${toToken}`
        }));

        // Wait a bit to show success message
        await new Promise(resolve => setTimeout(resolve, 2000));

        return true;
      }

      return false;
    } catch (error: any) {
      console.error('Swap error:', error);
      setSwapProgress(prev => ({
        ...prev,
        status: 'error',
        message: totalSwaps > 1 ? 
          `❌ Swap ${currentSwap} of ${totalSwaps} failed: ${error.message || 'Unknown error'}` :
          `❌ Swap failed: ${error.message || 'Unknown error'}`
      }));
      
      // Wait a bit to show error message
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      throw error;
    } finally {
      // Only hide if this is the last swap or there's an error
      if (swapProgress.status === 'error' || currentSwap === totalSwaps) {
        setSwapProgress(prev => ({ ...prev, isVisible: false }));
      }
    }
  };

  const handleSwapAndPay = async () => {
    setIsSwapping(true);

    try {
      if (payWithPyusd) {
        // NEW FLOW: Pay with PYUSD
        console.log('🔄 Starting PYUSD payment flow...');

        // Calculate total needed for each token (ignoring existing balances)
        const totalNeeded = validEmployees.reduce((acc, emp) => {
          const token = emp.token?.toUpperCase() || '';
          const amount = parseFloat(emp.payment_amount?.toString() || '0');
          acc[token] = (acc[token] || 0) + amount;
          return acc;
        }, {} as Record<string, number>);

        console.log('Total amounts needed per token:', totalNeeded);

        // Add buffers
        const tokensToSwap: Array<{ token: 'ETH' | 'USDC', amount: number }> = [];
        
        if (totalNeeded['ETH']) {
          const buffer = 0.001;
          tokensToSwap.push({ 
            token: 'ETH', 
            amount: totalNeeded['ETH'] + buffer 
          });
        }

        if (totalNeeded['USDC']) {
          const buffer = 3;
          tokensToSwap.push({ 
            token: 'USDC', 
            amount: totalNeeded['USDC'] + buffer 
          });
        }

        console.log('Tokens to swap from PYUSD:', tokensToSwap);

        // Calculate total PYUSD needed
        let totalPyusdNeeded = 0;
        tokensToSwap.forEach(({ token, amount }) => {
          if (token === 'ETH') {
            // ETH: 1 ETH = 2000 PYUSD
            totalPyusdNeeded += amount * 2000;
          } else if (token === 'USDC') {
            // USDC: 1:1 with PYUSD
            totalPyusdNeeded += amount;
          }
        });

        console.log(`Total PYUSD needed: ${totalPyusdNeeded.toFixed(2)}`);
        console.log(`Available PYUSD: ${pyusdBalance.toFixed(2)}`);

        // Perform all swaps from PYUSD
        for (let i = 0; i < tokensToSwap.length; i++) {
          const { token, amount } = tokensToSwap[i];
          console.log(`🔄 Swapping PYUSD → ${amount.toFixed(6)} ${token}...`);
          
          const swapSuccess = await performSwap('PYUSD', token, amount, i + 1, tokensToSwap.length);

          if (!swapSuccess) {
            toast({
              title: "❌ Swap Failed",
              description: `Failed to swap PYUSD to ${token}`,
              variant: "destructive",
            });
            return;
          }

          toast({
            title: "✅ Swap Successful",
            description: `Swapped PYUSD → ${amount.toFixed(4)} ${token}`,
          });

          // Small delay between swaps
          if (i < tokensToSwap.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        // All swaps complete, proceed with payment
        toast({
          title: "🎉 All Swaps Complete!",
          description: "Now processing payments to employees...",
        });

        // Re-check balances after swaps
        await checkBalances();

        // Small delay to ensure balance update
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Now proceed with payment
        onPayAll(group);

      } else {
        // ORIGINAL FLOW: Normal swap & pay
        const shortfalls = Object.entries(balanceCheck.required).filter(([_, amount]) => amount > 0);
        
        if (shortfalls.length === 0) {
          // No shortfall, just pay
          onPayAll(group);
          return;
        }

        if (shortfalls.length > 1) {
          // Multiple token shortfalls - not supported yet
          toast({
            title: "⚠️ Multiple Token Shortfall",
            description: "Please add more tokens manually. Auto-swap supports single token shortfalls only.",
            variant: "destructive",
          });
          return;
        }

        // Single token shortfall
        const [tokenNeeded, amountNeeded] = shortfalls[0];
        const tokenNeededUpper = tokenNeeded.toUpperCase() as 'ETH' | 'USDC';

        // Determine which token to swap from
        let swapFrom: 'ETH' | 'USDC';
        if (tokenNeededUpper === 'USDC') {
          swapFrom = 'ETH';
          // Check if we have enough ETH to swap
          const ethNeeded = amountNeeded / 2000;
          if ((balanceCheck.available['ETH'] || 0) < ethNeeded) {
            toast({
              title: "⚠️ Insufficient ETH for Swap",
              description: `Need ${ethNeeded.toFixed(6)} ETH on Sepolia to swap for ${amountNeeded.toFixed(2)} USDC`,
              variant: "destructive",
            });
            return;
          }
        } else {
          swapFrom = 'USDC';
          // Check if we have enough USDC to swap
          const usdcNeeded = amountNeeded * 2000;
          if ((balanceCheck.available['USDC'] || 0) < usdcNeeded) {
            toast({
              title: "⚠️ Insufficient USDC for Swap",
              description: `Need ${usdcNeeded.toFixed(2)} USDC on Sepolia to swap for ${amountNeeded.toFixed(6)} ETH`,
              variant: "destructive",
            });
            return;
          }
        }

        // Perform the swap on Sepolia (single swap)
        const swapSuccess = await performSwap(swapFrom, tokenNeededUpper, amountNeeded, 1, 1);

        if (swapSuccess) {
          toast({
            title: "🎉 Swap Successful!",
            description: `Swapped on Sepolia to get ${amountNeeded.toFixed(4)} ${tokenNeededUpper}. Now processing payments...`,
          });

          // Re-check balances after swap
          await checkBalances();

          // Small delay to ensure balance update
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Now proceed with payment
          onPayAll(group);
        }
      }

    } catch (error: any) {
      toast({
        title: "❌ Swap Failed",
        description: error.message || "Failed to swap tokens on Sepolia",
        variant: "destructive",
      });
    } finally {
      setIsSwapping(false);
    }
  };

  useEffect(() => {
    // Only run once when component mounts and SDK is initialized
    if (nexusSDK && isInitialized) {
      checkBalances();
    }
  }, []); // Empty dependency array means it only runs once on mount

  // Determine button text and action
  const getButtonConfig = () => {
    if (isProcessingPayment === group.id) {
      return {
        text: 'Processing...',
        icon: <Loader2 className="mr-2 h-4 w-4 animate-spin" />,
        disabled: true,
        onClick: () => {}
      };
    }

    if (isSwapping) {
      return {
        text: 'Swapping...',
        icon: <ArrowRightLeft className="mr-2 h-4 w-4 animate-spin" />,
        disabled: true,
        onClick: () => {}
      };
    }

    if (validEmployees.length === 0) {
      return {
        text: 'No Valid Employees',
        icon: <Send className="mr-2 h-4 w-4" />,
        disabled: true,
        onClick: () => {}
      };
    }

    if (payWithPyusd) {
      // PYUSD payment mode - always enabled regardless of balance
      const totalNeeded = validEmployees.reduce((acc, emp) => {
        const token = emp.token?.toUpperCase() || '';
        const amount = parseFloat(emp.payment_amount?.toString() || '0');
        acc[token] = (acc[token] || 0) + amount;
        return acc;
      }, {} as Record<string, number>);

      // Calculate total PYUSD needed
      let totalPyusdNeeded = 0;
      if (totalNeeded['ETH']) {
        totalPyusdNeeded += (totalNeeded['ETH'] + 0.001) * 2000;
      }
      if (totalNeeded['USDC']) {
        totalPyusdNeeded += totalNeeded['USDC'] + 3;
      }

      return {
        text: 'Swap & Pay',
        icon: <ArrowRightLeft className="mr-2 h-4 w-4" />,
        disabled: false,
        onClick: handleSwapAndPay,
        subtitle: `Using ${totalPyusdNeeded.toFixed(2)} PYUSD`
      };
    }

    if (!hasEnoughBalance) {
      const shortfalls = Object.entries(balanceCheck.required).filter(([_, amount]) => amount > 0);
      
      if (shortfalls.length === 1) {
        const [token, amount] = shortfalls[0];
        return {
          text: `Swap & Pay All`,
          icon: <ArrowRightLeft className="mr-2 h-4 w-4" />,
          disabled: false,
          onClick: handleSwapAndPay,
          subtitle: `Need ${amount.toFixed(4)} ${token} `
        };
      } else {
        return {
          text: 'Add More Tokens',
          icon: <AlertCircle className="mr-2 h-4 w-4" />,
          disabled: true,
          onClick: () => {}
        };
      }
    }

    return {
      text: 'Pay All',
      icon: <Send className="mr-2 h-4 w-4" />,
      disabled: false,
      onClick: () => onPayAll(group)
    };
  };

  const buttonConfig = getButtonConfig();

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
      >
        <Card className="glass-card p-6 hover-lift h-full">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="p-3 bg-gradient-to-r from-primary to-blue-500 rounded-xl">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <Badge className="bg-green-500/20 text-green-700 hover:bg-green-500/30">
                {group.status}
              </Badge>
            </div>

            <div>
              <h3 className="text-xl font-bold mb-2">{group.name}</h3>
              {group.employer && (
                <p className="text-sm text-muted-foreground">
                  {group.employer.email}
                </p>
              )}
            </div>

            <div className="space-y-3 pt-2 border-t border-white/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Users className="h-4 w-4" />
                  Employees
                </div>
                <div className="font-semibold">{group.employees}</div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <DollarSign className="h-4 w-4" />
                  Total Payment
                </div>
                <div className="font-bold gradient-text">
                  {formatTotalPayment(group)}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Calendar className="h-4 w-4" />
                  Next Payment
                </div>
                <div className="text-sm font-medium">{group.nextPayment}</div>
              </div>
            </div>

            {/* Pay with PYUSD Toggle */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src="https://assets.coingecko.com/coins/images/31212/small/PYUSD_Logo_%282%29.png"
                    alt="PYUSD"
                    className="w-5 h-5 rounded-full"
                  />
                  <div>
                    <p className="text-xs font-semibold text-purple-800">Pay with PYUSD</p>
                   
                  </div>
                </div>
                <Switch
                  checked={payWithPyusd}
                  onCheckedChange={setPayWithPyusd}
                  // Removed the disabled prop to allow toggle regardless of balance
                />
              </div>
            </div>

         

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1 glass-card border-white/20"
                onClick={() => onEdit(group.id)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit Group
              </Button>
              <div className="flex-1 flex flex-col gap-1">
                <Button
                  className="w-full bg-gradient-to-r from-primary to-cyan-500 hover:opacity-90"
                  onClick={buttonConfig.onClick}
                  disabled={buttonConfig.disabled}
                >
                  {buttonConfig.icon}
                  {buttonConfig.text}
                </Button>
                {buttonConfig.subtitle && (
                  <p className="text-xs text-center text-muted-foreground">
                    {buttonConfig.subtitle}
                  </p>
                )}
              </div>
            </div>

            {group.employeeDetails && group.employeeDetails.length > 0 && (
              <div className="pt-4 border-t border-white/20">
                <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Employees</h4>
                <div className="space-y-2">
                  {group.employeeDetails.slice(0, 3).map((employee, empIndex) => (
                    <div key={empIndex} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                        <span>{employee.first_name} {employee.last_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {parseFloat(employee.payment_amount?.toString() || '0').toFixed(2)} {employee.token?.toUpperCase()}
                        </span>
                        {employee.wallet_address ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>
                  ))}
                  {group.employeeDetails.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center pt-1">
                      +{group.employeeDetails.length - 3} more employees
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Swap Progress Overlay */}
      {swapProgress.isVisible && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-gradient-to-br from-purple-900/50 via-blue-900/50 to-cyan-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-gradient-to-br from-white/95 to-purple-50/95 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-white/20"
          >
            {/* Header */}
            <div className="text-center mb-6">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-400 to-cyan-600 flex items-center justify-center shadow-lg"
              >
                {swapProgress.status === 'complete' ? (
                  <CheckCircle className="h-10 w-10 text-white" />
                ) : swapProgress.status === 'error' ? (
                  <XCircle className="h-10 w-10 text-white" />
                ) : (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  >
                    <ArrowRightLeft className="h-10 w-10 text-white" />
                  </motion.div>
                )}
              </motion.div>
              
              <h3 className="text-2xl font-bold gradient-text mb-2">
                {swapProgress.status === 'complete' ? 'Swap Complete!' :
                 swapProgress.status === 'error' ? 'Swap Failed' :
                 swapProgress.status === 'switching' ? 'Switching Network' :
                 'Swapping on Sepolia'}
              </h3>
              
              {/* Show swap progress for multiple swaps */}
              {swapProgress.totalSwaps > 1 && (
                <div className="mb-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    Swap {swapProgress.currentSwap} of {swapProgress.totalSwaps}
                  </Badge>
                </div>
              )}
              
              <p className="text-sm text-gray-600">{swapProgress.message}</p>
            </div>

            {/* Swap Details */}
            <div className="space-y-4">
              <div className="glass-card p-4 rounded-xl border border-white/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">From</span>
                  <span className="text-sm font-semibold">{swapProgress.fromToken}</span>
                </div>
                <div className="text-2xl font-bold text-right">
                  {swapProgress.fromAmount || '---'} {swapProgress.fromToken}
                </div>
              </div>

              <div className="flex justify-center">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <ArrowRightLeft className="h-5 w-5 text-primary" />
                </div>
              </div>

              <div className="glass-card p-4 rounded-xl border border-white/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">To</span>
                  <span className="text-sm font-semibold">{swapProgress.toToken}</span>
                </div>
                <div className="text-2xl font-bold text-right gradient-text">
                  {swapProgress.toAmount} {swapProgress.toToken}
                </div>
              </div>

              {/* Network Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <p className="text-xs font-semibold text-blue-800">
                    Swapping on Sepolia Testnet
                  </p>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ 
                    width: swapProgress.status === 'complete' ? '100%' :
                          swapProgress.status === 'error' ? '100%' :
                          swapProgress.status === 'swapping' ? '66%' :
                          swapProgress.status === 'approving' ? '50%' :
                          swapProgress.status === 'switching' ? '25%' :
                          '10%'
                  }}
                  transition={{ duration: 0.5 }}
                  className={`h-2 rounded-full ${
                    swapProgress.status === 'complete' ? 'bg-gradient-to-r from-green-400 to-emerald-600' :
                    swapProgress.status === 'error' ? 'bg-gradient-to-r from-red-400 to-red-600' :
                    'bg-gradient-to-r from-blue-400 to-cyan-600'
                  }`}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
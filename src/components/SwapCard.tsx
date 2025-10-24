import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowDownUp, ChevronDown } from 'lucide-react';
import { Contract, parseUnits, formatUnits } from 'ethers';
import { toast } from '@/hooks/use-toast';
import { CONTRACT_ADDRESSES, SWAP_ABI, ERC20_ABI } from '@/lib/contracts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SwapCardProps {
  provider: any;
  signer: any;
  account: string;
}

type Token = 'ETH' | 'USDC' | 'PYUSD';

const TOKENS = [
  { symbol: 'ETH', decimals: 18, color: 'text-[hsl(var(--eth-color))]' },
  { symbol: 'USDC', decimals: 6, color: 'text-[hsl(var(--usdc-color))]' },
  { symbol: 'PYUSD', decimals: 6, color: 'text-[hsl(var(--pyusd-color))]' },
];

export function SwapCard({ provider, signer, account }: SwapCardProps) {
  const [fromToken, setFromToken] = useState<Token>('ETH');
  const [toToken, setToToken] = useState<Token>('USDC');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [fromBalance, setFromBalance] = useState('0');
  const [isSwapping, setIsSwapping] = useState(false);

  const getBalance = async (token: Token) => {
    try {
      if (token === 'ETH') {
        const balance = await provider.getBalance(account);
        return formatUnits(balance, 18);
      } else {
        const tokenAddress = token === 'USDC' ? CONTRACT_ADDRESSES.USDC : CONTRACT_ADDRESSES.PYUSD;
        const contract = new Contract(tokenAddress, ERC20_ABI, provider);
        const balance = await contract.balanceOf(account);
        return formatUnits(balance, 6);
      }
    } catch (error) {
      console.error('Error getting balance:', error);
      return '0';
    }
  };

  const calculateOutput = async (amount: string) => {
    if (!amount || parseFloat(amount) === 0) {
      setToAmount('');
      return;
    }

    try {
      const contract = new Contract(CONTRACT_ADDRESSES.SWAP, SWAP_ABI, provider);
      const fromDecimals = TOKENS.find(t => t.symbol === fromToken)?.decimals || 18;
      const toDecimals = TOKENS.find(t => t.symbol === toToken)?.decimals || 18;
      const inputAmount = parseUnits(amount, fromDecimals);

      let output;
      if (fromToken === 'ETH' && toToken === 'USDC') {
        output = await contract.calculateEthToUsdc(inputAmount);
      } else if (fromToken === 'ETH' && toToken === 'PYUSD') {
        output = await contract.calculateEthToPyusd(inputAmount);
      } else if (fromToken === 'USDC' && toToken === 'ETH') {
        output = await contract.calculateUsdcToEth(inputAmount);
      } else if (fromToken === 'PYUSD' && toToken === 'ETH') {
        output = await contract.calculatePyusdToEth(inputAmount);
      } else if (fromToken === 'USDC' && toToken === 'PYUSD') {
        output = await contract.calculateUsdcToPyusd(inputAmount);
      } else if (fromToken === 'PYUSD' && toToken === 'USDC') {
        output = await contract.calculatePyusdToUsdc(inputAmount);
      }

      if (output) {
        setToAmount(formatUnits(output, toDecimals));
      }
    } catch (error) {
      console.error('Error calculating output:', error);
    }
  };

  const approveToken = async (token: Token, amount: string) => {
    const tokenAddress = token === 'USDC' ? CONTRACT_ADDRESSES.USDC : CONTRACT_ADDRESSES.PYUSD;
    const contract = new Contract(tokenAddress, ERC20_ABI, signer);
    const decimals = TOKENS.find(t => t.symbol === token)?.decimals || 6;
    const amountBN = parseUnits(amount, decimals);

    const tx = await contract.approve(CONTRACT_ADDRESSES.SWAP, amountBN);
    await tx.wait();
  };

  const executeSwap = async () => {
    if (!fromAmount || parseFloat(fromAmount) === 0) {
      toast({ title: "Enter an amount", variant: "destructive" });
      return;
    }

    setIsSwapping(true);
    try {
      const contract = new Contract(CONTRACT_ADDRESSES.SWAP, SWAP_ABI, signer);
      const fromDecimals = TOKENS.find(t => t.symbol === fromToken)?.decimals || 18;
      const amount = parseUnits(fromAmount, fromDecimals);

      // Approve if needed
      if (fromToken !== 'ETH') {
        toast({ title: "Approving token..." });
        await approveToken(fromToken, fromAmount);
      }

      let tx;
      if (fromToken === 'ETH' && toToken === 'USDC') {
        tx = await contract.swapEthForUsdc({ value: amount });
      } else if (fromToken === 'ETH' && toToken === 'PYUSD') {
        tx = await contract.swapEthForPyusd({ value: amount });
      } else if (fromToken === 'USDC' && toToken === 'ETH') {
        tx = await contract.swapUsdcForEth(amount);
      } else if (fromToken === 'PYUSD' && toToken === 'ETH') {
        tx = await contract.swapPyusdForEth(amount);
      } else if (fromToken === 'USDC' && toToken === 'PYUSD') {
        tx = await contract.swapUsdcForPyusd(amount);
      } else if (fromToken === 'PYUSD' && toToken === 'USDC') {
        tx = await contract.swapPyusdForUsdc(amount);
      }

      toast({ title: "Swapping...", description: "Transaction submitted" });
      await tx.wait();
      
      toast({ title: "Swap Successful!", description: `Swapped ${fromAmount} ${fromToken} for ${toAmount} ${toToken}` });
      
      setFromAmount('');
      setToAmount('');
      await updateBalance();
    } catch (error: any) {
      toast({ 
        title: "Swap Failed", 
        description: error.message || "Transaction failed",
        variant: "destructive" 
      });
    } finally {
      setIsSwapping(false);
    }
  };

  const switchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const updateBalance = async () => {
    const balance = await getBalance(fromToken);
    setFromBalance(balance);
  };

  useEffect(() => {
    updateBalance();
  }, [fromToken, account]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (fromAmount) {
        calculateOutput(fromAmount);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [fromAmount, fromToken, toToken]);

  return (
    <Card className="p-6 backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
      <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
        Swap Tokens
      </h2>
      
      <div className="space-y-4">
        <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>From</span>
            <span>Balance: {parseFloat(fromBalance).toFixed(6)}</span>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="0.0"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              className="text-2xl font-semibold bg-transparent border-none focus-visible:ring-0 h-12"
            />
            <Select value={fromToken} onValueChange={(value) => setFromToken(value as Token)}>
              <SelectTrigger className="w-[140px] bg-secondary border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOKENS.filter(t => t.symbol !== toToken).map(token => (
                  <SelectItem key={token.symbol} value={token.symbol}>
                    <span className={token.color}>{token.symbol}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={switchTokens}
            className="rounded-full bg-secondary hover:bg-secondary/80 border border-border/50"
          >
            <ArrowDownUp className="h-4 w-4" />
          </Button>
        </div>

        <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>To</span>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="0.0"
              value={toAmount}
              readOnly
              className="text-2xl font-semibold bg-transparent border-none focus-visible:ring-0 h-12"
            />
            <Select value={toToken} onValueChange={(value) => setToToken(value as Token)}>
              <SelectTrigger className="w-[140px] bg-secondary border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOKENS.filter(t => t.symbol !== fromToken).map(token => (
                  <SelectItem key={token.symbol} value={token.symbol}>
                    <span className={token.color}>{token.symbol}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={executeSwap}
          disabled={isSwapping || !fromAmount || parseFloat(fromAmount) === 0}
          className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
        >
          {isSwapping ? 'Swapping...' : 'Swap'}
        </Button>
      </div>
    </Card>
  );
}
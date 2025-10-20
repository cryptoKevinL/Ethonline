import { useNexus } from "@/providers/NexusProvider";
import { CHAIN_METADATA, type UserAsset } from "@avail-project/nexus-core";
import { DollarSign, Loader2, ChevronDown, Wallet } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const TESTNET_CHAIN_IDS = [11155111, 84532, 421614, 11155420, 80002];
const TARGET_TOKENS = ["USDC", "ETH", "WETH"];

export const UnifiedBalanceButton = () => {
  const [unifiedBalance, setUnifiedBalance] = useState<UserAsset[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { nexusSDK, isInitialized } = useNexus();

  const fetchUnifiedBalance = async () => {
    if (!nexusSDK || !isInitialized) return;
    
    setIsLoading(true);
    try {
      const balance = await nexusSDK.getUnifiedBalances();
      console.log("Unified Balance:", balance);
      
      // Filter for target tokens and testnet chains
      const filteredBalance = balance?.map(token => ({
        ...token,
        breakdown: token.breakdown.filter(chain => 
          TESTNET_CHAIN_IDS.includes(chain.chain.id)
        )
      })).filter(token => 
        TARGET_TOKENS.includes(token.symbol) && 
        token.breakdown.length > 0
      );
      
      setUnifiedBalance(filteredBalance);
    } catch (error) {
      console.error("Error fetching unified balance:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isInitialized && nexusSDK) {
      fetchUnifiedBalance();
    }
  }, [isInitialized, nexusSDK]);

  const formatBalance = (balance: string, decimals: number) => {
    const num = parseFloat(balance);
    return num.toFixed(Math.min(6, decimals));
  };

  const getTotalBalance = () => {
    if (!unifiedBalance) return "0.00";
    return unifiedBalance
      .reduce((acc, token) => acc + token.balanceInFiat, 0)
      .toFixed(2);
  };

  const getTokenIcon = (symbol: string) => {
    const icons: Record<string, string> = {
      ETH: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
      WETH: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
      USDC: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
    };
    return icons[symbol] || "";
  };

  if (!isInitialized) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2 bg-gradient-to-r from-primary/10 to-blue-500/10 border-primary/20 hover:border-primary/40"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Wallet className="h-4 w-4" />
              <span className="font-semibold">${getTotalBalance()}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="end">
        <div className="p-4 border-b bg-gradient-to-r from-primary/5 to-blue-500/5">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-5 w-5 text-primary" strokeWidth={3} />
            <h3 className="font-semibold text-lg">Unified Balance</h3>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-bold">${getTotalBalance()}</span>
            <span className="text-sm text-muted-foreground">Total</span>
          </div>
        </div>

        <div className="p-4 max-h-[500px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full space-y-3">
              {unifiedBalance
                ?.filter((token) => parseFloat(token.balance) > 0)
                .map((token) => (
                  <AccordionItem
                    key={token.symbol}
                    value={token.symbol}
                    className="border rounded-lg overflow-hidden bg-card"
                  >
                    <AccordionTrigger className="hover:no-underline px-4 py-3 hover:bg-accent/50">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 rounded-full overflow-hidden bg-white flex items-center justify-center border">
                            <img
                              src={getTokenIcon(token.symbol)}
                              alt={token.symbol}
                              className="w-7 h-7 object-contain"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.parentElement!.innerHTML = `<div class="text-xs font-bold text-primary">${token.symbol}</div>`;
                              }}
                            />
                          </div>
                          <div className="text-left">
                            <h3 className="font-semibold text-base">{token.symbol}</h3>
                            <p className="text-sm text-muted-foreground">
                              ${token.balanceInFiat.toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-medium">
                            {formatBalance(token.balance, 6)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {token.symbol}
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-3">
                      <Separator className="mb-3" />
                      <div className="space-y-2">
                        {token.breakdown
                          .filter((chain) => parseFloat(chain.balance) > 0)
                          .map((chain, index, filteredChains) => (
                            <Fragment key={chain.chain.id}>
                              <div className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="relative h-7 w-7 rounded-full overflow-hidden bg-white flex items-center justify-center border">
                                    <img
                                      src={CHAIN_METADATA[chain?.chain?.id]?.logo}
                                      alt={chain.chain.name}
                                      className="w-5 h-5 object-contain"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                      }}
                                    />
                                  </div>
                                  <span className="text-sm font-medium">
                                    {chain.chain.name}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium">
                                    {formatBalance(chain.balance, chain.decimals)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    ${chain.balanceInFiat.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                              {index < filteredChains.length - 1 && (
                                <Separator className="my-1" />
                              )}
                            </Fragment>
                          ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
            </Accordion>
          )}

          {!isLoading && (!unifiedBalance || unifiedBalance.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No balances found</p>
              <p className="text-sm mt-1">
                Get USDC or ETH on supported testnets
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
import { useState } from "react";
import { motion } from "framer-motion";
import { useAccount, useBalance } from "wagmi";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Send, Wallet, ArrowRight, Copy, ExternalLink } from "lucide-react";

// Helper function to get chain display info
const getChainDisplayInfo = (chain: string) => {
  const chainMap: { [key: string]: { name: string; logo: JSX.Element; gradient: string } } = {
    'sepolia': {
      name: 'Ethereum Sepolia',
      gradient: 'from-purple-400 to-blue-500',
      logo: (
        <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/>
        </svg>
      )
    },
    'base': {
      name: 'Base Sepolia',
      gradient: 'from-blue-400 to-cyan-500',
      logo: (
        <svg className="w-7 h-7 text-white" viewBox="0 0 111 111" fill="currentColor">
          <path d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 22.1714 0 50.3923H72.8467V59.6416H3.9565e-07C2.35281 87.8625 26.0432 110.034 54.921 110.034Z"/>
        </svg>
      )
    },
    'arbitrum': {
      name: 'Arbitrum Sepolia',
      gradient: 'from-blue-500 to-purple-600',
      logo: (
        <svg className="w-7 h-7 text-white" viewBox="0 0 38 33" fill="currentColor">
          <path d="M29 10.2c-.7-.4-1.6-.4-2.4 0L21 13.5l-3.8 2.1-5.5 3.3c-.7.4-1.6.4-2.4 0L5 16.3c-.7-.4-1.2-1.2-1.2-2.1v-4c0-.8.4-1.6 1.2-2.1l4.3-2.5c.7-.4 1.6-.4 2.4 0L16 8.2c.7.4 1.2 1.2 1.2 2.1v3.3l3.8-2.2V8c0-.8-.4-1.6-1.2-2.1l-8-4.7c-.7-.4-1.6-.4-2.4 0L1.2 5.9C.4 6.3 0 7.1 0 8v9.4c0 .8.4 1.6 1.2 2.1l8.1 4.7c.7.4 1.6.4 2.4 0l5.5-3.2 3.8-2.2 5.5-3.2c.7-.4 1.6-.4 2.4 0l4.3 2.5c.7.4 1.2 1.2 1.2 2.1v4c0 .8-.4 1.6-1.2 2.1L29 28.8c-.7.4-1.6.4-2.4 0l-4.3-2.5c-.7-.4-1.2-1.2-1.2-2.1V21l-3.8 2.2v3.3c0 .8.4 1.6 1.2 2.1l8.1 4.7c.7.4 1.6.4 2.4 0l8.1-4.7c.7-.4 1.2-1.2 1.2-2.1V17c0-.8-.4-1.6-1.2-2.1L29 10.2z"/>
        </svg>
      )
    }
  };

  return chainMap[chain.toLowerCase()];
};

// Helper function to get token display info
const getTokenDisplayInfo = (token: string) => {
  const tokenMap: { [key: string]: { logo: JSX.Element; gradient: string } } = {
    'eth': {
      gradient: 'from-purple-400 to-blue-500',
      logo: (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/>
        </svg>
      )
    },
    'usdc': {
      gradient: 'from-blue-500 to-blue-700',
      logo: (
        <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="16" fill="#2775CA"/>
          <path d="M11 16C11 13.2386 13.2386 11 16 11C18.7614 11 21 13.2386 21 16C21 18.7614 18.7614 21 16 21C13.2386 21 11 18.7614 11 16Z" stroke="white" strokeWidth="1.5" fill="none"/>
          <path d="M16 13C16 12.4477 16.4477 12 17 12C17.5523 12 18 12.4477 18 13C18 13.5523 17.5523 14 17 14H16V13Z" fill="white"/>
          <path d="M16 18C16 18.5523 16.4477 19 17 19C17.5523 19 18 18.5523 18 18C18 17.4477 17.5523 17 17 17H16V18Z" fill="white"/>
          <path d="M14 13C14 12.4477 14.4477 12 15 12C15.5523 12 16 12.4477 16 13V19C16 19.5523 15.5523 20 15 20C14.4477 20 14 19.5523 14 19V13Z" fill="white"/>
          <circle cx="16" cy="16" r="2" fill="white"/>
        </svg>
      )
    },
    'pyusd': {
      gradient: 'from-yellow-500 to-orange-600',
      logo: (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
          <path d="M2 17L12 22L22 17"/>
          <path d="M2 12L12 17L22 12"/>
        </svg>
      )
    }
  };

  return tokenMap[token.toLowerCase()];
};

export default function SendCrypto() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState("eth");
  const [selectedChain, setSelectedChain] = useState("sepolia");
  const [isProcessing, setIsProcessing] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const handleSend = async () => {
    if (!isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to send crypto",
        variant: "destructive",
      });
      return;
    }

    if (!recipientAddress || !amount) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      // TODO: Implement actual crypto sending logic here
      // This would involve:
      // 1. Validating the recipient address
      // 2. Checking sufficient balance
      // 3. Creating and signing the transaction
      // 4. Broadcasting the transaction
      
      toast({
        title: "Transaction Sent!",
        description: `Sending ${amount} ${selectedToken.toUpperCase()} to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`,
      });
      
      // Reset form
      setRecipientAddress("");
      setAmount("");
      
    } catch (error) {
      console.error("Error sending crypto:", error);
      toast({
        title: "Transaction Failed",
        description: "Failed to send crypto. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
      <Navbar role="admin" />
      
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold gradient-text mb-4">
              Send Crypto
            </h1>
            <p className="text-gray-600 text-lg">
              Send cryptocurrency to any address across supported networks
            </p>
          </div>

          {/* Main Card */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send Transaction
              </CardTitle>
              <CardDescription>
                Enter the recipient address and amount to send
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Network Selection */}
              <div className="space-y-2">
                <Label htmlFor="chain">Network</Label>
                <Select value={selectedChain} onValueChange={setSelectedChain}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select network" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sepolia">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getChainDisplayInfo('sepolia')?.gradient} flex items-center justify-center`}>
                          {getChainDisplayInfo('sepolia')?.logo}
                        </div>
                        <span>Ethereum Sepolia</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="base">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getChainDisplayInfo('base')?.gradient} flex items-center justify-center`}>
                          {getChainDisplayInfo('base')?.logo}
                        </div>
                        <span>Base Sepolia</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="arbitrum">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getChainDisplayInfo('arbitrum')?.gradient} flex items-center justify-center`}>
                          {getChainDisplayInfo('arbitrum')?.logo}
                        </div>
                        <span>Arbitrum Sepolia</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Token Selection */}
              <div className="space-y-2">
                <Label htmlFor="token">Token</Label>
                <Select value={selectedToken} onValueChange={setSelectedToken}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select token" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eth">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getTokenDisplayInfo('eth')?.gradient} flex items-center justify-center`}>
                          {getTokenDisplayInfo('eth')?.logo}
                        </div>
                        <span>ETH</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="usdc">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getTokenDisplayInfo('usdc')?.gradient} flex items-center justify-center`}>
                          {getTokenDisplayInfo('usdc')?.logo}
                        </div>
                        <span>USDC</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="pyusd">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getTokenDisplayInfo('pyusd')?.gradient} flex items-center justify-center`}>
                          {getTokenDisplayInfo('pyusd')?.logo}
                        </div>
                        <span>PYUSD</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Recipient Address */}
              <div className="space-y-2">
                <Label htmlFor="recipient">Recipient Address</Label>
                <div className="relative">
                  <Input
                    id="recipient"
                    type="text"
                    placeholder="0x..."
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    className="pr-10"
                  />
                  {recipientAddress && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6"
                      onClick={() => copyToClipboard(recipientAddress, "Recipient address")}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  step="0.000001"
                />
              </div>

              {/* Wallet Info */}
              {isConnected && address && (
                <div className="p-4 bg-gray-50/50 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-gray-600" />
                      <span className="text-sm text-gray-600">From:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">
                        {address.slice(0, 6)}...{address.slice(-4)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(address, "Wallet address")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Send Button */}
              <Button
                onClick={handleSend}
                disabled={!isConnected || !recipientAddress || !amount || isProcessing}
                className="w-full h-12 text-lg"
                size="lg"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    Send {amount} {selectedToken.toUpperCase()}
                  </div>
                )}
              </Button>

              {/* Transaction Preview */}
              {recipientAddress && amount && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="p-4 bg-blue-50/50 rounded-lg border border-blue-200/50"
                >
                  <h4 className="font-semibold text-blue-800 mb-3">Transaction Preview</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">From:</span>
                      <span className="font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">To:</span>
                      <span className="font-mono">{recipientAddress.slice(0, 6)}...{recipientAddress.slice(-4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-semibold">{amount} {selectedToken.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Network:</span>
                      <span className="font-semibold">{getChainDisplayInfo(selectedChain)?.name}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

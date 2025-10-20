import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useNexus } from '@/providers/NexusProvider';
import { Send, Wallet, ArrowRight, Copy, ExternalLink, User, Loader2 } from "lucide-react";
import { ProfileService } from "@/lib/profileService";

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

// Helper function to get chain ID
const getChainId = (chain: string) => {
  const chainMap: { [key: string]: number } = {
    'sepolia': 11155111,
    'base': 84532,
    'arbitrum': 421614
  };
  return chainMap[chain.toLowerCase()] || 11155111;
};

// Helper function to get token type for Nexus SDK
const getTokenType = (token: string) => {
  const tokenMap: { [key: string]: string } = {
    'eth': 'ETH',
    'usdc': 'USDC',
    'pyusd': 'USDC' // PYUSD maps to USDC for Nexus SDK
  };
  return tokenMap[token.toLowerCase()] || 'ETH';
};

export default function SendCryptoToUser() {
  const { walletAddress } = useParams<{ walletAddress: string }>();
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { nexusSDK, isInitialized } = useNexus();
  const { toast } = useToast();
  
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [employeeInfo, setEmployeeInfo] = useState<any>(null);
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(true);
  const [selectedToken, setSelectedToken] = useState("eth");
  const [selectedChain, setSelectedChain] = useState("sepolia");

  // Load employee information
  useEffect(() => {
    const loadEmployeeInfo = async () => {
      if (!walletAddress) return;
      
      setIsLoadingEmployee(true);
      try {
        // Try to find employee by wallet address
        const result = await ProfileService.searchEmployees(walletAddress);
        if (result.success && result.data && result.data.length > 0) {
          const employee = result.data[0];
          setEmployeeInfo(employee);
          
          // Set chain and token from employee preferences (required)
          setSelectedChain(employee.chain || "sepolia");
          setSelectedToken(employee.token || "eth");
        }
      } catch (error) {
        console.error('Error loading employee info:', error);
      } finally {
        setIsLoadingEmployee(false);
      }
    };

    loadEmployeeInfo();
  }, [walletAddress]);

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

    if (!walletAddress || !amount) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!nexusSDK || !isInitialized) {
      toast({
        title: "Nexus SDK Not Ready",
        description: "Please wait for the SDK to initialize. This may take a few moments.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      const destinationChainId = getChainId(selectedChain);
      const tokenType = getTokenType(selectedToken);

      // Prepare transfer parameters for Nexus SDK
      const transferParams = {
        token: tokenType,
        amount: amount,
        chainId: destinationChainId,
        recipient: walletAddress as `0x${string}`,
        sourceChains: [11155111] as number[] // Ethereum Sepolia as source
      };

      console.log('Transfer Parameters:', transferParams);

      // Simulate the transfer first
      try {
        console.log('=== RUNNING NEXUS SDK SIMULATION ===');
        const simulationResult = await nexusSDK.simulateTransfer(transferParams);
        console.log('Simulation Result:', simulationResult);
        console.log('=== SIMULATION COMPLETE ===');
      } catch (simulationError) {
        console.error('Simulation Error:', simulationError);
        console.log('Continuing with payment despite simulation error...');
      }

      // Execute the transfer
      const transferResult = await nexusSDK.transfer(transferParams);
      
      if (transferResult.success) {
        toast({
          title: "🎉 Payment Successful!",
          description: `Successfully sent ${amount} ${selectedToken.toUpperCase()} to ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
        });
        
        // Reset form
        setAmount("");
        
        // Navigate back after a delay
        setTimeout(() => {
          navigate('/admin/groups');
        }, 2000);
      } else {
        throw new Error("Transfer failed");
      }
      
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

  if (isLoadingEmployee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
        <Navbar role="admin" />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading employee information...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state if Nexus SDK is not ready
  if (!nexusSDK || !isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
        <Navbar role="admin" />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold gradient-text mb-4">
                Send Payment
              </h1>
              <p className="text-gray-600 text-lg">
                Initializing payment system...
              </p>
            </div>
            <Card className="glass-card">
              <CardContent className="p-8">
                <div className="flex items-center justify-center min-h-[200px]">
                  <div className="text-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    <p className="text-gray-600">Initializing Nexus SDK...</p>
                    <p className="text-sm text-gray-500">This may take a few moments</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

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
              Send Payment
            </h1>
            <p className="text-gray-600 text-lg">
              Send cryptocurrency to {employeeInfo ? `${employeeInfo.first_name} ${employeeInfo.last_name}` : 'employee'}
            </p>
          </div>

          {/* Employee Info Card */}
          {employeeInfo && (
            <Card className="glass-card mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Employee Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Name:</span>
                    <span className="font-semibold">{employeeInfo.first_name} {employeeInfo.last_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email:</span>
                    <span className="font-mono text-sm">{employeeInfo.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Wallet:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{walletAddress}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(walletAddress || '', "Wallet address")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Payment Card */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send Payment
              </CardTitle>
              <CardDescription>
                Enter the amount to send to this employee
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Payment Configuration Display */}
              <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-200/50">
                <h4 className="font-semibold text-blue-800 mb-3">Payment Configuration</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Token:</span>
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${getTokenDisplayInfo(selectedToken)?.gradient} flex items-center justify-center`}>
                        {getTokenDisplayInfo(selectedToken)?.logo}
                      </div>
                      <span className="font-semibold uppercase">{selectedToken}</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Network:</span>
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${getChainDisplayInfo(selectedChain)?.gradient} flex items-center justify-center`}>
                        {getChainDisplayInfo(selectedChain)?.logo}
                      </div>
                      <span className="font-semibold">{getChainDisplayInfo(selectedChain)?.name}</span>
                    </div>
                  </div>
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
                disabled={!isConnected || !amount || isProcessing || !nexusSDK || !isInitialized}
                className="w-full h-12 text-lg"
                size="lg"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </div>
                ) : !nexusSDK || !isInitialized ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Initializing...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    Send {amount} {selectedToken.toUpperCase()}
                  </div>
                )}
              </Button>

              {/* Transaction Preview */}
              {amount && (
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
                      <span className="font-mono">{walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-semibold">{amount} {selectedToken.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Network:</span>
                      <span className="font-semibold">{getChainDisplayInfo(selectedChain)?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Token Type:</span>
                      <span className="font-semibold">{getTokenType(selectedToken)}</span>
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

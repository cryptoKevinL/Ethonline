import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Building2, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProfileService } from "@/lib/profileService";
import { useNexus } from '@/providers/NexusProvider';
import { useAccount, usePublicClient } from 'wagmi';
import { GroupCard } from "@/components/groups/GroupCard";
import { IntentsSection } from "@/components/groups/IntentsSection";
import { 
  convertToUSDC, 
  formatTotalPayment, 
  getChainId, 
  getTokenType, 
  validateEmployeeData 
} from "@/utils/groupsUtils";
import { extractIntentData } from "@/utils/extractIntentData";

// Helper function to get chain display info
const getChainDisplayInfo = (chain: string) => {
  const chainMap: { [key: string]: { name: string; logo: JSX.Element; gradient: string } } = {
    'sepolia': {
      name: 'Sepolia',
      gradient: 'from-purple-400 to-blue-500',
      logo: (
        <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/>
        </svg>
      )
    },
    'ethereum': {
      name: 'Sepolia',
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
    'base-sepolia': {
      name: 'Base Sepolia',
      gradient: 'from-blue-400 to-cyan-500',
      logo: (
        <svg className="w-7 h-7 text-white" viewBox="0 0 111 111" fill="currentColor">
          <path d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 22.1714 0 50.3923H72.8467V59.6416H3.9565e-07C2.35281 87.8625 26.0432 110.034 54.921 110.034Z"/>
        </svg>
      )
    },
    'optimism': {
      name: 'Optimism Sepolia',
      gradient: 'from-red-400 to-red-600',
      logo: (
        <svg className="w-7 h-7 text-white" viewBox="0 0 500 500" fill="currentColor">
          <circle cx="250" cy="250" r="250"/>
        </svg>
      )
    },
    'optimism-sepolia': {
      name: 'Optimism Sepolia',
      gradient: 'from-red-400 to-red-600',
      logo: (
        <svg className="w-7 h-7 text-white" viewBox="0 0 500 500" fill="currentColor">
          <circle cx="250" cy="250" r="250"/>
        </svg>
      )
    },
    'arbitrum': {
      name: 'Arbitrum Sepolia',
      gradient: 'from-blue-500 to-blue-700',
      logo: (
        <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0L1.608 6v12L12 24l10.392-6V6L12 0zm0 3.6L19.2 7.8v8.4L12 20.4 4.8 16.2V7.8L12 3.6z"/>
        </svg>
      )
    },
    'arbitrum-sepolia': {
      name: 'Arbitrum Sepolia',
      gradient: 'from-blue-500 to-blue-700',
      logo: (
        <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0L1.608 6v12L12 24l10.392-6V6L12 0zm0 3.6L19.2 7.8v8.4L12 20.4 4.8 16.2V7.8L12 3.6z"/>
        </svg>
      )
    },
    'polygon': {
      name: 'Polygon',
      gradient: 'from-purple-500 to-purple-700',
      logo: (
        <svg className="w-7 h-7 text-white" viewBox="0 0 38 33" fill="currentColor">
          <path d="M29 10.2c-.7-.4-1.6-.4-2.4 0L21 13.5l-3.8 2.1-5.5 3.3c-.7.4-1.6.4-2.4 0L5 16.3c-.7-.4-1.2-1.2-1.2-2.1v-4c0-.8.4-1.6 1.2-2.1l4.3-2.5c.7-.4 1.6-.4 2.4 0L16 8.2c.7.4 1.2 1.2 1.2 2.1v3.3l3.8-2.2V8c0-.8-.4-1.6-1.2-2.1l-8-4.7c-.7-.4-1.6-.4-2.4 0L1.2 5.9C.4 6.3 0 7.1 0 8v9.4c0 .8.4 1.6 1.2 2.1l8.1 4.7c.7.4 1.6.4 2.4 0l5.5-3.2 3.8-2.2 5.5-3.2c.7-.4 1.6-.4 2.4 0l4.3 2.5c.7.4 1.2 1.2 1.2 2.1v4c0 .8-.4 1.6-1.2 2.1L29 28.8c-.7.4-1.6.4-2.4 0l-4.3-2.5c-.7-.4-1.2-1.2-1.2-2.1V21l-3.8 2.2v3.3c0 .8.4 1.6 1.2 2.1l8.1 4.7c.7.4 1.6.4 2.4 0l8.1-4.7c.7-.4 1.2-1.2 1.2-2.1V17c0-.8-.4-1.6-1.2-2.1L29 10.2z"/>
        </svg>
      )
    }
  };

  // Return the chain info if it exists, otherwise return undefined
  return chainMap[chain.toLowerCase()];
};

// Helper function to get token display info
const getTokenDisplayInfo = (token: string) => {
  const tokenMap: { [key: string]: { logo: JSX.Element; gradient: string } } = {
'usdc': {
      gradient: 'from-blue-500 to-blue-700',
      logo: (
        <svg className="w-15 h-15" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="16" fill="#2775CA"/>
          <path d="M11 16C11 13.2386 13.2386 11 16 11C18.7614 11 21 13.2386 21 16C21 18.7614 18.7614 21 16 21C13.2386 21 11 18.7614 11 16Z" stroke="white" strokeWidth="1.5" fill="none"/>
          <path d="M16 13C16 12.4477 16.4477 12 17 12C17.5523 12 18 12.4477 18 13C18 13.5523 17.5523 14 17 14H16V13Z" fill="white"/>
          <path d="M16 18C16 18.5523 16.4477 19 17 19C17.5523 19 18 18.5523 18 18C18 17.4477 17.5523 17 17 17H16V18Z" fill="white"/>
          <path d="M14 13C14 12.4477 14.4477 12 15 12C15.5523 12 16 12.4477 16 13V19C16 19.5523 15.5523 20 15 20C14.4477 20 14 19.5523 14 19V13Z" fill="white"/>
          <circle cx="16" cy="16" r="2" fill="white"/>
        </svg>
      )
    },
    'eth': {
      gradient: 'from-purple-400 to-blue-500',
      logo: (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/>
        </svg>
      )
    },
    'weth': {
      gradient: 'from-purple-500 to-indigo-600',
      logo: (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/>
        </svg>
      )
    }
  };

  // Return the token info if it exists, otherwise return undefined
  return tokenMap[token.toLowerCase()];
};

// Helper function to get chain name for Blockscout
const getChainName = (chainId: number) => {
  const chainMap: { [key: number]: string } = {
    1: 'eth',
    11155111: 'eth-sepolia',
    8453: 'base',
    84532: 'base-sepolia',
    42161: 'arbitrum',
    421614: 'arbitrum-sepolia',
    10: 'optimism',
    11155420: 'optimism-sepolia'
  };
  return chainMap[chainId] || '';
};

interface Group {
  id: string;
  name: string;
  employees: number;
  totalPayment: string;
  totalPaymentUSDC: number;
  nextPayment: string;
  status: string;
  created_at?: string;
  employer?: { id: string; name: string; email: string };
  employeeDetails?: Array<{
    id: string; first_name: string; last_name: string; email: string;
    payment_amount: number; payment_frequency: string; chain: string;
    token: string; status: string; role: string; wallet_address: string;
    employment_id?: string;
  }>;
}

const Groups = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { address, connector } = useAccount();
  const { nexusSDK, isInitialized } = useNexus();
  const publicClient = usePublicClient();
  
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<{ [key: string]: 'success' | 'error' | 'processing' }>({});
  const [paymentProgress, setPaymentProgress] = useState<{
    isVisible: boolean;
    currentStep: string;
    employeeName: string;
    amount: string;
    token: string;
    sourceChain: string;
    destinationChain: string;
    status: 'simulating' | 'signing' | 'confirming' | 'saving' | 'complete' | 'error';
    signatureStep: number;
    totalSignatures: number;
    signatureDescription: string;
  }>({
    isVisible: false,
    currentStep: '',
    employeeName: '',
    amount: '',
    token: '',
    sourceChain: 'sepolia',
    destinationChain: '',
    status: 'simulating',
    signatureStep: 0,
    totalSignatures: 0,
    signatureDescription: ''
  });
  const [userIntents, setUserIntents] = useState<any[]>([]);
  const [allUserIntents, setAllUserIntents] = useState<any[]>([]);
  const [isLoadingIntents, setIsLoadingIntents] = useState(false);
  const [intentsPage, setIntentsPage] = useState(1);
  const [showAllIntents, setShowAllIntents] = useState(false);

  useEffect(() => {
    const loadGroups = async () => {
      setIsLoading(true);
      try {
        const result = await ProfileService.getPaymentGroups();
        console.log('Raw groups data from database:', result);
        
        if (result.success && result.data && result.data.length > 0) {
          const processedGroups = await processGroupsWithWalletData(result.data);
          setGroups(processedGroups);
          console.log('Processed groups with wallet data:', processedGroups);
        } else {
          setGroups([]);
          console.log('No groups found in database');
          if (result.error) {
            console.error('Error loading groups:', result.error);
            toast({
              title: "Error",
              description: "Failed to load groups from database",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error('Error loading groups:', error);
        setGroups([]);
        toast({
          title: "Error",
          description: "Failed to load groups from database",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadGroups();
  }, [toast]);

  useEffect(() => {
    if (address) {
      console.log('🚀 Page loaded, starting initial fetch...');
      fetchUserIntents(1);
      
      console.log('⏰ Setting auto-refresh timeout for 3 seconds...');
      const autoRefreshTimeout = setTimeout(() => {
        console.log('🔄 AUTO-REFRESH TRIGGERED - Getting latest data...');
        fetchUserIntents(1);
      }, 3000);
      
      return () => {
        console.log('🧹 Cleaning up auto-refresh timeout');
        clearTimeout(autoRefreshTimeout);
      };
    }
  }, [address, groups]);

  useEffect(() => {
    if (isInitialized && nexusSDK) {
      console.log('🔄 Nexus SDK initialized, auto-refreshing payments...');
      const refreshTimeout = setTimeout(() => {
        console.log('🔄 AUTO-REFRESH AFTER SDK INIT - Getting latest data...');
        fetchUserIntents(1);
      }, 2000);
      
      return () => clearTimeout(refreshTimeout);
    }
  }, [isInitialized, nexusSDK]);

  const processGroupsWithWalletData = async (groups: any[]) => {
    const processedGroups: Group[] = [];
    
    for (const group of groups) {
      if (group.employeeDetails && group.employeeDetails.length > 0) {
        const employeesWithWallets = [];
        let totalUSDC = 0;
        
        for (const employee of group.employeeDetails) {
          try {
            const walletResult = await ProfileService.getEmployeeWalletData(employee.id, employee.employment_id);
            
            if (walletResult.success && walletResult.data) {
              const employeeWithWallet = {
                ...employee,
                wallet_address: walletResult.data.account_address || '',
                chain: walletResult.data.chain || employee.chain || 'ethereum',
                token: walletResult.data.token || employee.token || 'usdc',
                payment_amount: (parseFloat(employee.payment_amount?.toString() || '0')).toString(),
                employment_id: employee.employment_id
              };
              
              employeesWithWallets.push(employeeWithWallet);
              totalUSDC += convertToUSDC(parseFloat(employee.payment_amount?.toString() || '0'), employee.token);
            } else {
              employeesWithWallets.push({
                ...employee,
                wallet_address: '',
                payment_amount: (parseFloat(employee.payment_amount?.toString() || '0')).toString(),
                employment_id: employee.employment_id
              });
              totalUSDC += convertToUSDC(parseFloat(employee.payment_amount?.toString() || '0'), employee.token);
            }
          } catch (error) {
            console.error(`Error fetching wallet for employee ${employee.id}:`, error);
            employeesWithWallets.push({
              ...employee,
              wallet_address: '',
              payment_amount: (parseFloat(employee.payment_amount?.toString() || '0')).toString(),
              employment_id: employee.employment_id
            });
            totalUSDC += convertToUSDC(parseFloat(employee.payment_amount?.toString() || '0'), employee.token);
          }
        }
        
        processedGroups.push({
          ...group,
          employeeDetails: employeesWithWallets,
          totalPaymentUSDC: totalUSDC
        } as Group);
      } else {
        processedGroups.push({
          ...group,
          totalPaymentUSDC: 0
        } as Group);
      }
    }
    
    return processedGroups;
  };

  const handlePayEmployee = async (group: Group, employee: any) => {
    if (!nexusSDK || !isInitialized) {
      toast({
        title: "Nexus SDK Not Ready",
        description: "Please wait for Nexus SDK to initialize.",
        variant: "destructive",
      });
      return { success: false, error: "Nexus SDK not ready" };
    }

    const paymentKey = `${group.id}-${employee.id}`;
    setIsProcessingPayment(paymentKey);
    setPaymentStatus(prev => ({ ...prev, [paymentKey]: 'processing' }));

    setPaymentProgress({
      isVisible: true,
      currentStep: 'Preparing payment...',
      employeeName: `${employee.first_name} ${employee.last_name}`,
      amount: `${employee.payment_amount}`,
      token: employee.token?.toUpperCase() || 'USDC',
      sourceChain: 'sepolia',
      destinationChain: employee.chain || 'base-sepolia',
      status: 'simulating',
      signatureStep: 0,
      totalSignatures: 3,
      signatureDescription: 'Preparing transaction simulation...'
    });

    try {
      validateEmployeeData(employee);

      const destinationChainId = getChainId(employee.chain);
      const standardSolverAddress = '0x247365225B96Cd8bc078F7263F6704f3EaD96494'; // Standard Nexus solver
      const tokenType = getTokenType(employee.token);

      const transferParams = {
        token: tokenType,
        amount: parseFloat(employee.payment_amount || '0').toString(),
        chainId: destinationChainId as any,
        recipient: employee.wallet_address as `0x${string}`,
        sourceChains: [11155111] as number[]
      };

      console.log('Transfer Parameters:', transferParams);
      console.log('Employee Data:', employee);

      setPaymentProgress(prev => ({ 
        ...prev, 
        currentStep: 'Simulating transaction...', 
        status: 'simulating',
        signatureStep: 1,
        signatureDescription: 'Simulating cross-chain transfer parameters...'
      }));
      
      try {
        console.log('=== RUNNING NEXUS SDK SIMULATION ===');
        const simulationResult = await nexusSDK.simulateTransfer(transferParams);
        console.log('Simulation Result:', simulationResult);
        console.log('=== SIMULATION COMPLETE ===');
      } catch (simulationError) {
        console.error('Simulation Error:', simulationError);
        console.log('Continuing with payment despite simulation error...');
      }

      setPaymentProgress(prev => ({ 
        ...prev, 
        currentStep: 'Please sign the token allowance in your wallet...', 
        status: 'signing',
        signatureStep: 1,
        signatureDescription: 'Signing token allowance to approve spending...'
      }));

      const transferResult = await nexusSDK.transfer(transferParams);

      setPaymentProgress(prev => ({ 
        ...prev, 
        currentStep: 'Please sign the deposit to solver...', 
        status: 'signing',
        signatureStep: 2,
        signatureDescription: 'Signing deposit transaction to send tokens to solver...'
      }));

      // Wait a moment to show the second signature step
      await new Promise(resolve => setTimeout(resolve, 1000));

      setPaymentProgress(prev => ({ 
        ...prev, 
        currentStep: 'Please sign the direct transfer to employee...', 
        status: 'signing',
        signatureStep: 3,
        signatureDescription: 'Signing direct transfer to employee on destination chain...'
      }));

      setPaymentProgress(prev => ({ 
        ...prev, 
        currentStep: 'Confirming all transactions...', 
        status: 'confirming',
        signatureStep: 3,
        signatureDescription: 'All signatures complete, confirming on blockchain...'
      }));

      console.log('=== TRANSFER RESULT OBJECT ===');
      console.log('TransferResult:', transferResult);
      console.log('Success:', transferResult.success);
      console.log('All transferResult properties:', Object.keys(transferResult));
      
      if (transferResult.success) {
        console.log('Transaction Hash:', transferResult.transactionHash);
        console.log('Explorer URL:', transferResult.explorerUrl);
      } else {
        console.log('Error:', "Transfer failed");
      }
      console.log('=== END TRANSFER RESULT ===');

      if (transferResult.success) {
        setPaymentStatus(prev => ({ ...prev, [paymentKey]: 'success' }));
        
        setPaymentProgress(prev => ({ 
          ...prev, 
          currentStep: 'Saving payment details...', 
          status: 'saving',
          signatureStep: 3,
          signatureDescription: 'Saving payment record to database...'
        }));

        try {
          let employmentId = employee.employment_id;
          if (!employmentId && group.employer?.id) {
            try {
              const employmentResult = await ProfileService.findEmploymentId(group.employer.id, employee.id);
              if (employmentResult.success && employmentResult.data) {
                employmentId = employmentResult.data;
              }
            } catch (error) {
              console.error('Error finding employment_id:', error);
            }
          }
        
          const intentId = (transferResult as any).intentId || 
                          (transferResult as any).intent_id || 
                          (transferResult as any).id || 
                          '';
          
          const recentTxData = await getRecentTransactionHash();
          
          const firstTxHash = recentTxData.hash || 
                             (transferResult as any).sourceTxHash || 
                             (transferResult as any).depositTxHash || 
                             (transferResult as any).initialTxHash ||
                             transferResult.transactionHash || 
                             (transferResult as any).txHash || 
                             (transferResult as any).hash || 
                             '';
          
          const depositSolverAddress = recentTxData.solverAddress || '';
          
          // Find solver → employer transaction hash
          let solverToEmployerHash = '';
          try {
            const chainName = getChainName(destinationChainId);
            if (chainName && address) {
              console.log(`🔍 Searching for solver → employer transaction on ${chainName}...`);
              const internalResponse = await fetch(`https://${chainName}.blockscout.com/api/v2/addresses/${address}/internal-transactions`);
              if (internalResponse.ok) {
                const internalData = await internalResponse.json();
                if (internalData.items && internalData.items.length > 0) {
                  // Take the first (most recent) internal transaction
                  const employerTx = internalData.items[0];
                  solverToEmployerHash = employerTx.transaction_hash || '';
                  console.log('✅ Found solver → employer transaction (internal):', solverToEmployerHash);
                }
              }
            }
          } catch (error) {
            console.error('Error finding solver → employer transaction:', error);
          }
          
          console.log('Extracted intent ID:', intentId);
          console.log('First transaction hash (deposit):', firstTxHash);
          console.log('Final transaction hash (transfer):', transferResult.transactionHash);
          console.log('Deposit solver address:', depositSolverAddress);
          console.log('Solver → employer hash:', solverToEmployerHash);
          
          if (firstTxHash && firstTxHash !== transferResult.transactionHash) {
            console.log('✅ Successfully captured different deposit and transfer transaction hashes using Supabase function');
          } else if (firstTxHash) {
            console.log('⚠️ Deposit and transfer hashes are the same - may need to wait longer for indexing');
          } else {
            console.log('❌ No deposit transaction hash found via Supabase function - using transfer hash as fallback');
          }
          
          let finalIntentId = intentId;
          if (!finalIntentId && transferResult.explorerUrl) {
            const urlMatch = transferResult.explorerUrl.match(/intent\/([a-zA-Z0-9-_]+)/);
            if (urlMatch && urlMatch[1]) {
              finalIntentId = urlMatch[1];
              console.log('Extracted intent ID from URL:', finalIntentId);
            }
          }
          
          const paymentResult = await ProfileService.savePayment({
            employment_id: employmentId || null,
            employer_id: group.employer?.id,
            employee_id: employee.id,
            chain: employee.chain,
            token: employee.token,
            token_contract: employee.token_contract,
            token_decimals: employee.token_decimals,
            amount_token: employee.payment_amount || '0',
            recipient: employee.wallet_address,
            tx_hash: transferResult.transactionHash,
            intent_id: finalIntentId,
            first_tx_hash: firstTxHash,
            deposit_solver_address: depositSolverAddress,
            solver_address: standardSolverAddress,
            solver_to_employer_hash: solverToEmployerHash,
            status: 'confirmed'
          });

          if (paymentResult.success) {
            console.log('Payment saved to database:', paymentResult.data);
          }
        } catch (dbError) {
          console.error('Error saving payment to database:', dbError);
        }
        
        setPaymentProgress(prev => ({ 
          ...prev, 
          currentStep: 'Payment completed successfully!', 
          status: 'complete',
          signatureStep: 3,
          signatureDescription: 'All signatures processed and payment complete!'
        }));
        
        setTimeout(() => {
          setPaymentProgress(prev => ({ ...prev, isVisible: false }));
        }, 2000);

        toast({
          title: "🎉 Payment Successful!",
          description: `Sent ${parseFloat(employee.payment_amount || '0').toFixed(2)} ${tokenType} to ${employee.first_name} ${employee.last_name}`,
        });

        setTimeout(() => {
          fetchUserIntents(1);
        }, 3000);

        return { success: true, transactionHash: transferResult.transactionHash };

      } else {
        console.error('Transfer failed:', transferResult);
        setPaymentStatus(prev => ({ ...prev, [paymentKey]: 'error' }));
        
        setPaymentProgress(prev => ({ 
          ...prev, 
          currentStep: 'Payment failed', 
          status: 'error',
          signatureStep: 0,
          signatureDescription: 'Payment failed during processing...'
        }));
        
        setTimeout(() => {
          setPaymentProgress(prev => ({ ...prev, isVisible: false }));
        }, 3000);
        
        toast({
          title: "❌ Payment Failed",
          description: "Unknown error occurred during transfer",
          variant: "destructive",
        });

        return { success: false, error: "Transfer failed" };
      }

    } catch (error) {
      console.error('Error processing payment:', error);
      setPaymentStatus(prev => ({ ...prev, [paymentKey]: 'error' }));
      
      setPaymentProgress(prev => ({ 
        ...prev, 
        currentStep: 'Payment failed', 
        status: 'error',
        signatureStep: 0,
        signatureDescription: 'An error occurred during payment processing...'
      }));
      
      setTimeout(() => {
        setPaymentProgress(prev => ({ ...prev, isVisible: false }));
      }, 3000);
      
      const errorMessage = error instanceof Error ? error.message : "Failed to process payment";
      
      toast({
        title: "💸 Payment Error",
        description: errorMessage,
        variant: "destructive",
      });

      return { success: false, error: errorMessage };
    } finally {
      setIsProcessingPayment(null);
    }
  };

  const handlePayAllEmployees = async (group: Group) => {
    if (!group.employeeDetails || group.employeeDetails.length === 0) {
      toast({
        title: "No Employees",
        description: "This group has no employees to pay.",
        variant: "destructive",
      });
      return;
    }

    const validEmployees = group.employeeDetails.filter(emp => 
      emp.wallet_address && 
      emp.wallet_address.trim() !== '' && 
      emp.payment_amount && 
      emp.payment_amount > 0
    );

    if (validEmployees.length === 0) {
      toast({
        title: "No Valid Employees",
        description: "No employees in this group have valid wallet addresses or payment amounts.",
        variant: "destructive",
      });
      return;
    }

    if (validEmployees.length < group.employeeDetails.length) {
      toast({
        title: "Some Employees Skipped",
        description: `${group.employeeDetails.length - validEmployees.length} employees skipped due to missing wallet addresses or payment amounts.`,
        variant: "default",
      });
    }

    setIsProcessingPayment(group.id);
    
    try {
      let successfulPayments = 0;
      let failedPayments = 0;

      for (let i = 0; i < validEmployees.length; i++) {
        const employee = validEmployees[i];
        
        toast({
          title: "Processing Payments",
          description: `Processing payment ${i + 1}/${validEmployees.length} for ${employee.first_name} ${employee.last_name}`,
        });

        console.log(`=== PROCESSING PAYMENT ${i + 1}/${validEmployees.length} ===`);
        console.log('Employee:', `${employee.first_name} ${employee.last_name}`);
        console.log('Amount:', employee.payment_amount);
        console.log('Recipient:', employee.wallet_address);
        
        const result = await handlePayEmployee(group, employee);
        
        if (result.success) {
          successfulPayments++;
        } else {
          failedPayments++;
        }

        if (i < validEmployees.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (failedPayments === 0) {
        toast({
          title: "✅ All Payments Complete",
          description: `Successfully processed all ${successfulPayments} payments in ${group.name}`,
        });
      } else {
        toast({
          title: "⚠️ Payments Partially Complete",
          description: `Completed ${successfulPayments} payments, ${failedPayments} failed in ${group.name}`,
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('Error in batch payment:', error);
      toast({
        title: "Batch Payment Error",
        description: "Failed to process batch payment for all employees",
        variant: "destructive",
      });
    } finally {
      setIsProcessingPayment(null);
    }
  };

  const fetchUserIntents = async (page: number = 1, loadAll: boolean = false) => {
    if (!nexusSDK || !isInitialized) {
      console.log('Nexus SDK not ready');
      return;
    }

    setIsLoadingIntents(true);
    try {
      console.log('=== FETCHING INTENTS FROM SDK ===');
      const intents = await nexusSDK.getMyIntents(page);
      console.log('Number of intents found:', intents?.length);
      
      if (intents && intents.length > 0) {
        const processedIntents = await Promise.all(
          intents.map(async (intent: any, index: number) => {
            const intentData = await extractIntentData(intent, address || '');
            return {
              ...intentData,
              timestamp: intentData.timestamp - (index * 3600)
            };
          })
        );
        
        setUserIntents(processedIntents.slice(0, 3));
        setAllUserIntents(processedIntents);
        setIntentsPage(page);
      } else {
        console.log('No intents found for user');
        setUserIntents([]);
        setAllUserIntents([]);
        
        toast({
          title: "No Intents Found",
          description: "No payment intents found for your account",
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Error fetching user intents:', error);
      setUserIntents([]);
      setAllUserIntents([]);
      
      toast({
        title: "Error Loading Intents",
        description: "Failed to load payment intents from SDK",
        variant: "destructive",
      });
    } finally {
      setIsLoadingIntents(false);
    }
  };

  const handleShowAllIntents = () => {
    if (showAllIntents) {
      setUserIntents(allUserIntents.slice(0, 3));
      setShowAllIntents(false);
    } else {
      setUserIntents(allUserIntents.slice(0, 10));
      setShowAllIntents(true);
    }
  };

  const getRecentTransactionHash = async (): Promise<{ hash: string | null; solverAddress: string | null }> => {
    if (!address) return { hash: null, solverAddress: null };
    
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      try {
        if (connector) {
          const provider = await connector.getProvider();
          if (provider && typeof provider === 'object' && 'request' in provider) {
            const txCount = await (provider as any).request({
              method: 'eth_getTransactionCount',
              params: [address, 'latest']
            });
            console.log('Current transaction count:', txCount);
          }
        }
      } catch (error) {
        console.log('Could not get transaction count from wallet:', error);
      }
      
      try {
        console.log('Trying Supabase function for Sepolia (chain: eth-sepolia)...');
        const response = await fetch(`https://memgpowzdqeuwdpueajh.functions.supabase.co/blockscout?chain=eth-sepolia&address=${address}&api=v2`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Supabase function response:', data);
          
          let transactions = [];
          if (data.result && Array.isArray(data.result)) {
            transactions = data.result;
          } else if (data.items && Array.isArray(data.items)) {
            transactions = data.items;
          } else if (Array.isArray(data)) {
            transactions = data;
          }
          
          if (transactions.length > 0) {
            const latestTx = transactions[0];
            console.log('Found recent transaction from Supabase function:', latestTx.hash);
            console.log('Transaction details:', {
              hash: latestTx.hash,
              from: latestTx.from,
              to: latestTx.to,
              value: latestTx.value,
              gasPrice: latestTx.gasPrice || latestTx.gas_price,
              timestamp: latestTx.timestamp || latestTx.timeStamp
            });
            const solverAddress = typeof latestTx.to === 'string' ? latestTx.to : latestTx.to?.hash || '';
            console.log('Solver address (transaction destination):', solverAddress);
            return { hash: latestTx.hash, solverAddress };
          } else {
            console.log('No transactions found in Supabase function response');
          }
        } else {
          const errorText = await response.text();
          console.log('Supabase function error:', response.status, errorText);
        }
      } catch (error) {
        console.log('Supabase function failed:', error);
      }
      
      if (!publicClient) {
        return { hash: null, solverAddress: null };
      }
      
      const blockNumber = await publicClient.getBlockNumber();
      
      for (let i = 0; i < 20; i++) {
        try {
          const blockNumberToCheck = blockNumber - BigInt(i);
          const block = await publicClient.getBlock({ blockNumber: blockNumberToCheck, includeTransactions: true });
          
          if (block && block.transactions) {
            for (const tx of block.transactions) {
              if (typeof tx === 'object' && tx.from && tx.from.toLowerCase() === address.toLowerCase()) {
                console.log('Found outgoing transaction hash:', tx.hash, 'in block', blockNumberToCheck);
                const solverAddress = typeof tx.to === 'string' ? tx.to : (tx.to as { hash?: string })?.hash || '';
                console.log('Solver address (transaction destination):', solverAddress);
                return { hash: tx.hash, solverAddress };
              }
            }
          }
        } catch (error) {
          continue;
        }
      }
      
      return { hash: null, solverAddress: null };
    } catch (error) {
      console.error('Error fetching recent transaction hash:', error);
      return { hash: null, solverAddress: null };
    }
  };

  const handleViewTransactionHistory = async () => {
    if (!address) {
      toast({
        title: "Error",
        description: "Please connect your wallet to view transaction history",
        variant: "destructive",
      });
      return;
    }

    await fetchUserIntents(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
      <Navbar role="admin" />
      
      <div className="container mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto space-y-8"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold gradient-text">Payment Groups</h1>
              <p className="text-muted-foreground">
                {isLoading ? "Loading groups..." : `Manage all your payment groups (${groups.length} groups)`}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleViewTransactionHistory}
                variant="outline"
                className="glass-card border-white/20"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Transactions
              </Button>
              <Button
                onClick={() => navigate("/admin/create-group")}
                className="bg-gradient-to-r from-primary to-blue-500 hover:opacity-90"
              >
                <Building2 className="mr-2 h-4 w-4" />
                Create New Group
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-muted-foreground">Loading payment groups...</span>
              </div>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-6 bg-white/50 rounded-xl max-w-md mx-auto">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Payment Groups Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first payment group to get started with managing employee payments.
                </p>
                <Button
                  onClick={() => navigate("/admin/create-group")}
                  className="bg-gradient-to-r from-primary to-blue-500 hover:opacity-90"
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  Create Your First Group
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.map((group, index) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    index={index}
                    isProcessingPayment={isProcessingPayment}
                    formatTotalPayment={formatTotalPayment}
                    onEdit={(groupId) => navigate(`/admin/edit-group/${groupId}`)}
                    onPayAll={handlePayAllEmployees}
                  />
                ))}
              </div>

              <IntentsSection
                userIntents={userIntents}
                allUserIntents={allUserIntents}
                isLoadingIntents={isLoadingIntents}
                showAllIntents={showAllIntents}
                onRefresh={() => fetchUserIntents(1)}
                onToggleShowAll={handleShowAllIntents}
              />
            </>
          )}
        </motion.div>
      </div>

      {/* Payment Progress Overlay */}
      {paymentProgress.isVisible && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-gradient-to-br from-purple-900/50 via-blue-900/50 to-cyan-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-gradient-to-br from-white/95 to-purple-50/95 rounded-2xl p-8 max-w-3xl w-full mx-4 shadow-2xl border border-white/20"
          >
            {/* Header with Chain & Token Info */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <motion.div 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-center gap-3"
                >
                  {/* Source Chain */}
                  {getChainDisplayInfo(paymentProgress.sourceChain) && (
                    <div className="flex flex-col items-center">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getChainDisplayInfo(paymentProgress.sourceChain)!.gradient} flex items-center justify-center shadow-lg`}>
                        {getChainDisplayInfo(paymentProgress.sourceChain)!.logo}
                      </div>
                      <span className="text-xs font-medium text-gray-600 mt-1">{getChainDisplayInfo(paymentProgress.sourceChain)!.name}</span>
                    </div>
                  )}

                  {/* Animated Arrow */}
                  {getChainDisplayInfo(paymentProgress.sourceChain) && getChainDisplayInfo(paymentProgress.destinationChain) && (
                    <motion.div 
                      animate={{ x: [0, 10, 0] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="flex items-center gap-1"
                    >
                      <div className="h-px w-12 bg-gradient-to-r from-purple-400 to-blue-500"></div>
                      <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </motion.div>
                  )}

                  {/* Destination Chain */}
                  {getChainDisplayInfo(paymentProgress.destinationChain) && (
                    <div className="flex flex-col items-center">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getChainDisplayInfo(paymentProgress.destinationChain)!.gradient} flex items-center justify-center shadow-lg`}>
                        {getChainDisplayInfo(paymentProgress.destinationChain)!.logo}
                      </div>
                      <span className="text-xs font-medium text-gray-600 mt-1">{getChainDisplayInfo(paymentProgress.destinationChain)!.name}</span>
                    </div>
                  )}
                </motion.div>

                {/* Token Info */}
                {getTokenDisplayInfo(paymentProgress.token) && (
                  <motion.div 
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-center gap-2 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-purple-200/50"
                  >
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getTokenDisplayInfo(paymentProgress.token)!.gradient} flex items-center justify-center shadow-md`}>
                      {getTokenDisplayInfo(paymentProgress.token)!.logo}
                    </div>
                    <span className="text-sm font-semibold gradient-text">{paymentProgress.amount} {paymentProgress.token}</span>
                  </motion.div>
                )}
              </div>

              {/* Status Header */}
              <motion.h3 
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-bold gradient-text text-center mb-2"
              >
                {paymentProgress.status === 'complete' ? '🎉 Payment Complete!' : 
                 paymentProgress.status === 'error' ? '❌ Payment Failed' : 
                 '⚡ Processing Payment...'}
              </motion.h3>
              
              <motion.p 
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-sm text-gray-600 text-center"
              >
                {paymentProgress.currentStep}
              </motion.p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Left Column - Employee Info & Status */}
              <div className="space-y-4">
                {/* Employee Info */}
                <motion.div 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="glass-card p-4 rounded-xl border border-white/20"
                >
                  <h4 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Recipient Details</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">{paymentProgress.employeeName.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{paymentProgress.employeeName}</p>
                        <p className="text-xs text-gray-500">Employee</p>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Animated Status Icon */}
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: "spring" }}
                  className="flex justify-center"
                >
                  {paymentProgress.status === 'simulating' && (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg relative">
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        className="absolute inset-0 border-4 border-transparent border-t-white rounded-full"
                      ></motion.div>
                      <span className="text-2xl">⚙️</span>
                    </div>
                  )}
                  {paymentProgress.status === 'signing' && (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
                      <motion.span 
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 1 }}
                        className="text-2xl"
                      >✍️</motion.span>
                    </div>
                  )}
                  {paymentProgress.status === 'confirming' && (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg">
                      <motion.span 
                        animate={{ rotate: [0, 360] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="text-2xl"
                      >🔄</motion.span>
                    </div>
                  )}
                  {paymentProgress.status === 'saving' && (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shadow-lg">
                      <motion.span 
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="text-2xl"
                      >💾</motion.span>
                    </div>
                  )}
                  {paymentProgress.status === 'complete' && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.2, 1] }}
                      transition={{ duration: 0.5 }}
                      className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg"
                    >
                      <span className="text-3xl">✓</span>
                    </motion.div>
                  )}
                  {paymentProgress.status === 'error' && (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg">
                      <span className="text-3xl">✗</span>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Right Column - Signature Progress */}
              <div className="space-y-4">
                {paymentProgress.totalSignatures > 0 && (
                  <motion.div 
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="glass-card p-4 rounded-xl border border-white/20"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Signature Progress</h4>
                      <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                        {paymentProgress.signatureStep} / {paymentProgress.totalSignatures}
                      </span>
                    </div>
                    
                    {/* Signature Steps */}
                    <div className="space-y-3">
                      {[
                        { step: 1, label: 'Token Allowance', icon: '🔓' },
                        { step: 2, label: 'Deposit to Solver', icon: '💰' },
                        { step: 3, label: 'Direct Transfer', icon: '📤' }
                      ].map(({ step, label, icon }) => (
                        <motion.div 
                          key={step}
                          initial={{ x: 20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.5 + (step * 0.1) }}
                          className={`flex items-center space-x-3 p-3 rounded-lg transition-all ${
                            step <= paymentProgress.signatureStep 
                              ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200' 
                              : step === paymentProgress.signatureStep + 1 && paymentProgress.status === 'signing'
                              ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 animate-pulse'
                              : 'bg-gray-50 border border-gray-200'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                            step <= paymentProgress.signatureStep 
                              ? 'bg-gradient-to-br from-green-400 to-emerald-600 text-white shadow-md' 
                              : step === paymentProgress.signatureStep + 1 && paymentProgress.status === 'signing'
                              ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-md'
                              : 'bg-gray-200 text-gray-500'
                          }`}>
                            {step <= paymentProgress.signatureStep ? '✓' : icon}
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${
                              step <= paymentProgress.signatureStep 
                                ? 'text-green-700' 
                                : step === paymentProgress.signatureStep + 1 && paymentProgress.status === 'signing'
                                ? 'text-yellow-700'
                                : 'text-gray-500'
                            }`}>
                              {label}
                            </p>
                            {step === paymentProgress.signatureStep && paymentProgress.status === 'signing' && (
                              <motion.p 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-xs text-yellow-600 mt-1"
                              >
                                {paymentProgress.signatureDescription}
                              </motion.p>
                            )}
                          </div>
                          {step <= paymentProgress.signatureStep && (
                            <motion.div 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="text-green-500"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </motion.div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-6"
            >
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ 
                    width: paymentProgress.status === 'complete' ? '100%' :
                          paymentProgress.status === 'error' ? '100%' :
                          paymentProgress.status === 'signing' ? 
                            `${Math.round((paymentProgress.signatureStep / paymentProgress.totalSignatures) * 100)}%` :
                          paymentProgress.status === 'confirming' ? '90%' :
                          paymentProgress.status === 'saving' ? '95%' :
                          '25%'
                  }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`h-3 rounded-full transition-all duration-500 ${
                    paymentProgress.status === 'complete' ? 'bg-gradient-to-r from-green-400 to-emerald-600' :
                    paymentProgress.status === 'error' ? 'bg-gradient-to-r from-red-400 to-red-600' :
                    paymentProgress.status === 'signing' ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                    paymentProgress.status === 'confirming' ? 'bg-gradient-to-r from-orange-400 to-red-500' :
                    paymentProgress.status === 'saving' ? 'bg-gradient-to-r from-purple-400 to-purple-600' :
                    'bg-gradient-to-r from-blue-400 to-blue-600'
                  }`}
                />
              </div>
              
              {/* Status Message */}
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-xs text-center text-gray-500 mt-3"
              >
                {paymentProgress.status === 'signing' && `Step ${paymentProgress.signatureStep}: ${paymentProgress.signatureDescription}`}
                {paymentProgress.status === 'confirming' && 'All signatures complete, waiting for blockchain confirmation...'}
                {paymentProgress.status === 'saving' && 'Saving payment details to database...'}
                {paymentProgress.status === 'complete' && getChainDisplayInfo(paymentProgress.sourceChain) && getChainDisplayInfo(paymentProgress.destinationChain) && `Payment has been successfully processed from ${getChainDisplayInfo(paymentProgress.sourceChain)!.name} to ${getChainDisplayInfo(paymentProgress.destinationChain)!.name}! 🎉`}
                {paymentProgress.status === 'error' && 'An error occurred during payment processing'}
                {paymentProgress.status === 'simulating' && getChainDisplayInfo(paymentProgress.sourceChain) && getChainDisplayInfo(paymentProgress.destinationChain) && `Preparing cross-chain transaction from ${getChainDisplayInfo(paymentProgress.sourceChain)!.name} to ${getChainDisplayInfo(paymentProgress.destinationChain)!.name}...`}
              </motion.p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default Groups;
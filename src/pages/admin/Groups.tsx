import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Building2, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProfileService } from "@/lib/profileService";
import { useNexus } from '@/providers/NexusProvider';
import { useAccount, usePublicClient, useWaitForTransactionReceipt } from 'wagmi';
import { GroupCard } from "@/components/groups/GroupCard";
import { IntentsSection } from "@/components/groups/IntentsSection";
import { PaymentHistory } from "@/components/groups/PaymentHistory";
import { 
  convertToUSDC, 
  formatTotalPayment, 
  getChainId, 
  getTokenType, 
  validateEmployeeData 
} from "@/utils/groupsUtils";
import { extractIntentData } from "@/utils/extractIntentData";

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
    status: 'simulating' | 'signing' | 'confirming' | 'saving' | 'complete' | 'error';
    signatureStep: number;
    totalSignatures: number;
    signatureDescription: string;
  }>({
    isVisible: false,
    currentStep: '',
    employeeName: '',
    amount: '',
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
      // Load intents from SDK (same as refresh button)
      fetchUserIntents(1);
      
      // Auto-refresh after page loads to get latest data
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

  // Auto-refresh after Nexus SDK is initialized
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

    // Show loading overlay
    setPaymentProgress({
      isVisible: true,
      currentStep: 'Preparing payment...',
      employeeName: `${employee.first_name} ${employee.last_name}`,
      amount: `${employee.payment_amount} ${employee.token?.toUpperCase()}`,
      status: 'simulating',
      signatureStep: 0,
      totalSignatures: 3, // Typically 3 signatures for cross-chain payments
      signatureDescription: 'Preparing transaction simulation...'
    });

    try {
      validateEmployeeData(employee);

      const destinationChainId = getChainId(employee.chain);
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

      // Run simulation first
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

      // Update progress for signing - Signature 1: Token allowance
      setPaymentProgress(prev => ({ 
        ...prev, 
        currentStep: 'Please sign the token allowance in your wallet...', 
        status: 'signing',
        signatureStep: 1,
        signatureDescription: 'Signing token allowance to approve spending...'
      }));

      const transferResult = await nexusSDK.transfer(transferParams);

      // Update progress for confirmation - Signature 2: Deposit to solver
      setPaymentProgress(prev => ({ 
        ...prev, 
        currentStep: 'Please sign the deposit to solver...', 
        status: 'signing',
        signatureStep: 2,
        signatureDescription: 'Signing deposit transaction to send tokens to solver...'
      }));

      // Wait a moment to show the second signature step
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update progress for final confirmation - Signature 3: Direct transfer to employee
      setPaymentProgress(prev => ({ 
        ...prev, 
        currentStep: 'Please sign the direct transfer to employee...', 
        status: 'signing',
        signatureStep: 3,
        signatureDescription: 'Signing direct transfer to employee on destination chain...'
      }));

      // Wait a moment to show the third signature step
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update progress for confirmation
      setPaymentProgress(prev => ({ 
        ...prev, 
        currentStep: 'Confirming all transactions...', 
        status: 'confirming',
        signatureStep: 3,
        signatureDescription: 'All signatures complete, confirming on blockchain...'
      }));

    // PRINT TRANSFER RESULT TO CONSOLE
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
        
        // Update progress for database saving
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
        
        // Extract intent ID from transfer result - try multiple possible property names
        const intentId = (transferResult as any).intentId || 
                        (transferResult as any).intent_id || 
                        (transferResult as any).id || 
                        '';
        
        // Try to get the most recent transaction hash from the user's wallet
        const recentTxData = await getRecentTransactionHash();
        
        // Extract first transaction hash (initial deposit from user's wallet)
        // Use the recent transaction hash from wallet/Blockscout, or fallback to SDK result
        const firstTxHash = recentTxData.hash || 
                           (transferResult as any).sourceTxHash || 
                           (transferResult as any).depositTxHash || 
                           (transferResult as any).initialTxHash ||
                           transferResult.transactionHash || 
                           (transferResult as any).txHash || 
                           (transferResult as any).hash || 
                           '';
        
        // Extract deposit solver address from transaction data if available
        const depositSolverAddress = recentTxData.solverAddress || '';
        
        console.log('Extracted intent ID:', intentId);
        console.log('First transaction hash (deposit):', firstTxHash);
        console.log('Final transaction hash (transfer):', transferResult.transactionHash);
        console.log('Deposit solver address:', depositSolverAddress);
        
        // Only log if we found a different transaction hash
        if (firstTxHash && firstTxHash !== transferResult.transactionHash) {
          console.log('✅ Successfully captured different deposit and transfer transaction hashes using Supabase function');
        } else if (firstTxHash) {
          console.log('⚠️ Deposit and transfer hashes are the same - may need to wait longer for indexing');
        } else {
          console.log('❌ No deposit transaction hash found via Supabase function - using transfer hash as fallback');
        }
        
        // If intent ID is still empty, try to extract from explorer URL
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
            solver_address: '0x247365225B96Cd8bc078F7263F6704f3EaD96494', // Standard solver address
            status: 'confirmed'
          });

          if (paymentResult.success) {
            console.log('Payment saved to database:', paymentResult.data);
          }
        } catch (dbError) {
          console.error('Error saving payment to database:', dbError);
        }
        
        // Update progress for completion
        setPaymentProgress(prev => ({ 
          ...prev, 
          currentStep: 'Payment completed successfully!', 
          status: 'complete',
          signatureStep: 3,
          signatureDescription: 'All signatures processed and payment complete!'
        }));
        
        // Hide loading overlay after a short delay
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
        
        // Update progress for error
        setPaymentProgress(prev => ({ 
          ...prev, 
          currentStep: 'Payment failed', 
          status: 'error',
          signatureStep: 0,
          signatureDescription: 'Payment failed during processing...'
        }));
        
        // Hide loading overlay after a short delay
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
      
      // Update progress for error
      setPaymentProgress(prev => ({ 
        ...prev, 
        currentStep: 'Payment failed', 
        status: 'error',
        signatureStep: 0,
        signatureDescription: 'An error occurred during payment processing...'
      }));
      
      // Hide loading overlay after a short delay
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
          // REMOVED: console.log(`\n=== PROCESSING INTENT ${index} ===`);
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
      
      // Debug popup disabled
      // toast({
      //   title: "Debug Data Loaded",
      //   description: `Found ${processedIntents.length} intents`,
      // });
      
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
      // Limit to 10 intents to prevent browser freeze
      setUserIntents(allUserIntents.slice(0, 10));
      setShowAllIntents(true);
    }
  };


  // Get the most recent transaction hash from the user's wallet
  const getRecentTransactionHash = async (): Promise<{ hash: string | null; solverAddress: string | null }> => {
    if (!address) return { hash: null, solverAddress: null };
    
    try {
      // Wait a bit for the transaction to be indexed
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      
      // Method 1: Try to get transaction from wallet connection
      try {
        if (connector) {
          const provider = await connector.getProvider();
          if (provider && typeof provider === 'object' && 'request' in provider) {
            // Try to get the transaction count to see if there are new transactions
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
      
      // Method 2: Use Supabase function for Sepolia
      try {
        console.log('Trying Supabase function for Sepolia (chain: eth-sepolia)...');
        const response = await fetch(`https://memgpowzdqeuwdpueajh.functions.supabase.co/blockscout?chain=eth-sepolia&address=${address}&api=v2`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Supabase function response:', data);
          
          // Handle both v1 and v2 API response formats
          let transactions = [];
          if (data.result && Array.isArray(data.result)) {
            // v1 API format
            transactions = data.result;
          } else if (data.items && Array.isArray(data.items)) {
            // v2 API format
            transactions = data.items;
          } else if (Array.isArray(data)) {
            // Direct array format
            transactions = data;
          }
          
          if (transactions.length > 0) {
            // Get the most recent transaction
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
            // Extract just the hash string from the 'to' field
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
      
      // Method 3: Use public client as fallback
      if (!publicClient) {
        return null;
      }
      
      // Get the latest block number
      const blockNumber = await publicClient.getBlockNumber();
      
      // Check the last 20 blocks for transactions
      for (let i = 0; i < 20; i++) {
        try {
          const blockNumberToCheck = blockNumber - BigInt(i);
          const block = await publicClient.getBlock({ blockNumber: blockNumberToCheck, includeTransactions: true });
          
          if (block && block.transactions) {
            // Look for transactions where the user's address is the 'from' field
            for (const tx of block.transactions) {
              if (typeof tx === 'object' && tx.from && tx.from.toLowerCase() === address.toLowerCase()) {
                     console.log('Found outgoing transaction hash:', tx.hash, 'in block', blockNumberToCheck);
                     // Extract just the hash string from the 'to' field
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


  // Load existing payments from database and show them as intents immediately
  const loadDatabasePaymentsAsIntents = async () => {
    if (!address) return;

    try {
      if (groups.length > 0 && groups[0].employer?.id) {
        console.log('🔄 Loading database payments as intents at:', new Date().toISOString());
        const paymentsResult = await ProfileService.getEmployerPayments(groups[0].employer.id, 10);
        
        if (paymentsResult.success && paymentsResult.data) {
          console.log('Loading database payments as intents:', paymentsResult.data);
          console.log('Number of payments returned:', paymentsResult.data.length);
          console.log('Intent IDs in order:', paymentsResult.data.map(p => p.intent_id));
          
          // Convert database payments to intent format
          const databaseIntents = paymentsResult.data.map((payment: any) => {
            const destinationChainId = getChainId(payment.chain);
            console.log(`Payment chain: ${payment.chain}, mapped to chain ID: ${destinationChainId}`);
            
            return {
              intentId: payment.intent_id,
              sourceAmount: payment.amount_token,
              sourceCurrency: payment.token?.toUpperCase() || 'ETH',
              destAmount: payment.amount_token, // Assuming same amount for now
              destCurrency: payment.token?.toUpperCase() || 'ETH',
              sourceChain: payment.chain,
              destChain: payment.chain, // Assuming same chain for now
              status: payment.status === 'confirmed' ? 'SUCCESS' : 'PENDING',
              timestamp: new Date(payment.created_at).getTime() / 1000,
              sender: address,
              recipient: payment.recipient,
              solver: payment.solver_address || '0x247365225B96Cd8bc078F7263F6704f3EaD96494', // Use stored solver or fallback
              totalFees: '0.0001', // Default fee
              senderToSolverHash: payment.first_tx_hash,
              solverToReceiverHash: payment.tx_hash,
              hasRealData: true,
              sourceChainId: 11155111, // Source is always Sepolia (deposit chain)
              destinationChainId: destinationChainId // Destination based on payment chain
            };
          });

          // Merge with existing intents (avoid duplicates)
          setUserIntents(prevIntents => {
            const existingIds = new Set(prevIntents.map(intent => intent.intentId));
            const newIntents = databaseIntents.filter(intent => !existingIds.has(intent.intentId));
            const result = [...newIntents, ...prevIntents].slice(0, 3);
            console.log('Setting userIntents to:', result.length, 'intents');
            return result;
          });

          setAllUserIntents(prevIntents => {
            const existingIds = new Set(prevIntents.map(intent => intent.intentId));
            const newIntents = databaseIntents.filter(intent => !existingIds.has(intent.intentId));
            const result = [...newIntents, ...prevIntents];
            console.log('Setting allUserIntents to:', result.length, 'intents');
            return result;
          });

          console.log('✅ Database payments loaded as intents');
        }
      }
    } catch (error) {
      console.error('Error loading database payments as intents:', error);
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
              {/* Payment Groups Section */}
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

              {/* User Intents Section */}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center">
              {/* Spinner */}
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <div className="absolute inset-0 border-4 border-blue-200 rounded-full animate-spin"></div>
                <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
              </div>
              
              {/* Status Icon */}
              <div className="mb-4">
                {paymentProgress.status === 'simulating' && (
                  <div className="w-12 h-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                    <div className="w-6 h-6 bg-blue-500 rounded-full animate-pulse"></div>
                  </div>
                )}
                {paymentProgress.status === 'signing' && (
                  <div className="w-12 h-12 mx-auto bg-yellow-100 rounded-full flex items-center justify-center">
                    <div className="w-6 h-6 bg-yellow-500 rounded-full animate-bounce"></div>
                  </div>
                )}
                {paymentProgress.status === 'confirming' && (
                  <div className="w-12 h-12 mx-auto bg-orange-100 rounded-full flex items-center justify-center">
                    <div className="w-6 h-6 bg-orange-500 rounded-full animate-pulse"></div>
                  </div>
                )}
                {paymentProgress.status === 'saving' && (
                  <div className="w-12 h-12 mx-auto bg-purple-100 rounded-full flex items-center justify-center">
                    <div className="w-6 h-6 bg-purple-500 rounded-full animate-pulse"></div>
                  </div>
                )}
                {paymentProgress.status === 'complete' && (
                  <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                    <div className="w-6 h-6 bg-green-500 rounded-full">✓</div>
                  </div>
                )}
                {paymentProgress.status === 'error' && (
                  <div className="w-12 h-12 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                    <div className="w-6 h-6 bg-red-500 rounded-full">✗</div>
                  </div>
                )}
              </div>
              
              {/* Progress Text */}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {paymentProgress.status === 'complete' ? 'Payment Complete!' : 
                 paymentProgress.status === 'error' ? 'Payment Failed' : 
                 'Processing Payment...'}
              </h3>
              
              <p className="text-sm text-gray-600 mb-4">
                {paymentProgress.currentStep}
              </p>
              
              {/* Employee Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Employee:</span> {paymentProgress.employeeName}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Amount:</span> {paymentProgress.amount}
                </p>
              </div>

              {/* Signature Progress */}
              {paymentProgress.totalSignatures > 0 && (
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-900">Signature Progress</span>
                    <span className="text-sm text-blue-700">
                      {paymentProgress.signatureStep} of {paymentProgress.totalSignatures}
                    </span>
                  </div>
                  
                  {/* Signature Steps */}
                  <div className="space-y-2">
                    {[1, 2, 3].map((step) => (
                      <div key={step} className="flex items-center space-x-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          step <= paymentProgress.signatureStep 
                            ? 'bg-green-500 text-white' 
                            : step === paymentProgress.signatureStep + 1 && paymentProgress.status === 'signing'
                            ? 'bg-yellow-500 text-white animate-pulse'
                            : 'bg-gray-200 text-gray-500'
                        }`}>
                          {step <= paymentProgress.signatureStep ? '✓' : step}
                        </div>
                        <div className="flex-1">
                          <p className={`text-xs ${
                            step <= paymentProgress.signatureStep 
                              ? 'text-green-700 font-medium' 
                              : step === paymentProgress.signatureStep + 1 && paymentProgress.status === 'signing'
                              ? 'text-yellow-700 font-medium'
                              : 'text-gray-500'
                          }`}>
                            {step === 1 && 'Token Allowance'}
                            {step === 2 && 'Deposit to Solver'}
                            {step === 3 && 'Direct Transfer to Employee'}
                          </p>
                          {step === paymentProgress.signatureStep && paymentProgress.status === 'signing' && (
                            <p className="text-xs text-yellow-600 mt-1">
                              {paymentProgress.signatureDescription}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${
                    paymentProgress.status === 'complete' ? 'bg-green-500 w-full' :
                    paymentProgress.status === 'error' ? 'bg-red-500 w-full' :
                    paymentProgress.status === 'signing' ? 
                      `bg-yellow-500 w-${Math.round((paymentProgress.signatureStep / paymentProgress.totalSignatures) * 100)}` :
                    paymentProgress.status === 'confirming' ? 'bg-orange-500 w-90' :
                    paymentProgress.status === 'saving' ? 'bg-purple-500 w-95' :
                    'bg-blue-500 w-25'
                  }`}
                  style={{
                    width: paymentProgress.status === 'signing' 
                      ? `${Math.round((paymentProgress.signatureStep / paymentProgress.totalSignatures) * 100)}%`
                      : undefined
                  }}
                ></div>
              </div>
              
              {/* Status Message */}
              <p className="text-xs text-gray-500">
                {paymentProgress.status === 'signing' && `Signature ${paymentProgress.signatureStep}: ${paymentProgress.signatureDescription}`}
                {paymentProgress.status === 'confirming' && 'All signatures complete, waiting for blockchain confirmation...'}
                {paymentProgress.status === 'saving' && 'Saving payment details to database...'}
                {paymentProgress.status === 'complete' && 'Payment has been successfully processed!'}
                {paymentProgress.status === 'error' && 'An error occurred during payment processing'}
                {paymentProgress.status === 'simulating' && 'Preparing cross-chain transaction...'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;
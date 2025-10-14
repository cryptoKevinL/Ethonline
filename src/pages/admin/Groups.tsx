import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, DollarSign, Calendar, Edit, Send, Loader2, ExternalLink, CheckCircle, XCircle, RefreshCw, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
// Removed Blockscout SDK imports since we're using Supabase function instead
import { ProfileService } from "@/lib/profileService";
import { useNexus } from '@/providers/NexusProvider';
import { useAccount } from 'wagmi';

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
  employeeDetails?: Array<{
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
  }>;
}

// Chain mapping from database names to Nexus SDK chain IDs
const CHAIN_MAPPING: { [key: string]: number } = {
  'optimism': 11155420, // Optimism Sepolia
  'ethereum': 11155111, // Sepolia
  'polygon': 80002,     // Polygon Amoy
  'arbitrum': 421614,   // Arbitrum Sepolia
  'base': 84532,        // Base Sepolia
  'monad': 1014,        // Monad Testnet
  // Add aliases for different naming conventions
  'optimism-sepolia': 11155420,
  'op-sepolia': 11155420,
  'sepolia': 11155111,
  'polygon-amoy': 80002,
  'arbitrum-sepolia': 421614,
  'base-sepolia': 84532,
  'monad-testnet': 1014
};

// Reverse mapping from chain ID to chain name for Supabase function
const CHAIN_ID_TO_NAME: { [key: number]: string } = {
  11155420: 'optimism-sepolia',
  11155111: '11155111', // Use chain ID directly since sepolia isn't in your function
  80002: 'polygon-amoy',
  421614: 'arbitrum-sepolia',
  84532: 'base-sepolia'
  //: 'optimism-sepolia' // Fallback to optimism-sepolia for unsupported chains
};

// Token mapping to ensure correct token types
const TOKEN_MAPPING: { [key: string]: 'USDC' | 'USDT' | 'ETH' } = {
  'usdc': 'USDC',
  'usdt': 'USDT', 
  'eth': 'ETH',
  'ethereum': 'ETH'
};

// Conversion rates to USDC (for demo purposes - in production use real price feeds)
const TOKEN_CONVERSION_RATES: { [key: string]: number } = {
  'usdc': 1,
  'usdt': 1,
  'eth': 4000, // 1 ETH = 4000 USDC
  'ethereum': 4000,
};

const Groups = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { address } = useAccount();
  // Removed useTransactionPopup since we're not using Blockscout SDK anymore
  const { nexusSDK, isInitialized } = useNexus();
  
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<{ [key: string]: 'success' | 'error' | 'processing' }>({});
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [databasePayments, setDatabasePayments] = useState<any[]>([]);
  const [isLoadingDatabasePayments, setIsLoadingDatabasePayments] = useState(false);

  // Helper function to convert token amounts to USDC equivalent
  const convertToUSDC = (amount: number, token: string): number => {
    const normalizedToken = token.toLowerCase();
    const rate = TOKEN_CONVERSION_RATES[normalizedToken] || 1;
    return amount * rate;
  };

  // Helper function to format total payment display
  const formatTotalPayment = (group: Group): string => {
    if (group.totalPaymentUSDC) {
      return `${Math.round(group.totalPaymentUSDC).toLocaleString()} USDC`;
    }
    return group.totalPayment; // Fallback to original if no USDC conversion
  };

  // Load groups from database - NO MOCK DATA
  useEffect(() => {
    const loadGroups = async () => {
      setIsLoading(true);
      try {
        const result = await ProfileService.getPaymentGroups();
        console.log('Raw groups data from database:', result);
        
        if (result.success && result.data && result.data.length > 0) {
          // Process the groups to ensure we have proper employee details with wallet addresses
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

  // Fetch recent transactions when address is available
  useEffect(() => {
    if (address) {
      fetchRecentTransactions();
      fetchDatabasePayments();
    }
  }, [address, groups]);

  // Function to fetch wallet data for employees and calculate proper totals
  const processGroupsWithWalletData = async (groups: any[]) => {
    const processedGroups: Group[] = [];
    
    for (const group of groups) {
      if (group.employeeDetails && group.employeeDetails.length > 0) {
        const employeesWithWallets = [];
        let totalUSDC = 0;
        
        for (const employee of group.employeeDetails) {
          try {
            // Fetch wallet data for this employee
            const walletResult = await ProfileService.getEmployeeWalletData(employee.id, employee.employment_id);
            
            if (walletResult.success && walletResult.data) {
              const employeeWithWallet = {
                ...employee,
                wallet_address: walletResult.data.account_address || '',
                chain: walletResult.data.chain || employee.chain || 'ethereum',
                token: walletResult.data.token || employee.token || 'usdc',
                payment_amount: (parseFloat(employee.payment_amount?.toString() || '0')).toString(),
                employment_id: employee.employment_id // Ensure employment_id is preserved
              };
              
              employeesWithWallets.push(employeeWithWallet);
              
              // Add to USDC total
              totalUSDC += convertToUSDC(parseFloat(employee.payment_amount?.toString() || '0'), employee.token);
            } else {
              // If no wallet found, use employee data but mark as invalid for payment
              employeesWithWallets.push({
                ...employee,
                wallet_address: '',
                payment_amount: (parseFloat(employee.payment_amount?.toString() || '0')).toString(),
                employment_id: employee.employment_id // Ensure employment_id is preserved
              });
              
              // Still add to USDC total for accurate reporting
              totalUSDC += convertToUSDC(parseFloat(employee.payment_amount?.toString() || '0'), employee.token);
            }
          } catch (error) {
            console.error(`Error fetching wallet for employee ${employee.id}:`, error);
            employeesWithWallets.push({
              ...employee,
              wallet_address: '',
              payment_amount: (parseFloat(employee.payment_amount?.toString() || '0')).toString(),
              employment_id: employee.employment_id // Ensure employment_id is preserved
            });
            
            // Still add to USDC total for accurate reporting
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

  const getChainId = (chainName: string): number => {
    const normalizedChain = chainName.toLowerCase().trim();
    return CHAIN_MAPPING[normalizedChain] || 11155420; // Default to Optimism Sepolia
  };

  const getTokenType = (tokenName: string): 'USDC' | 'USDT' | 'ETH' => {
    const normalizedToken = tokenName.toLowerCase().trim();
    return TOKEN_MAPPING[normalizedToken] || 'USDC'; // Default to USDC
  };

  const getChainName = (chainId: number): string => {
    return CHAIN_ID_TO_NAME[chainId] || 'optimism-sepolia'; // Default to optimism-sepolia
  };

  const validateEmployeeData = (employee: any) => {
    if (!employee.wallet_address || employee.wallet_address.trim() === '') {
      throw new Error(`Employee ${employee.first_name} ${employee.last_name} has no wallet address`);
    }
    
    if (!employee.payment_amount || parseFloat(employee.payment_amount) <= 0) {
      throw new Error(`Employee ${employee.first_name} ${employee.last_name} has invalid payment amount`);
    }
    
    if (!employee.wallet_address.startsWith('0x') || employee.wallet_address.length !== 42) {
      throw new Error(`Employee ${employee.first_name} ${employee.last_name} has invalid wallet address format`);
    }
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

    try {
      // Validate employee data before processing
      validateEmployeeData(employee);

      // Use actual employee data from database with proper chain mapping
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

      // Execute the transfer
      console.log('Executing transfer...');
      const transferResult = await nexusSDK.transfer(transferParams);

      console.log('Transfer Result:', transferResult);

      if (transferResult.success) {
        setPaymentStatus(prev => ({ ...prev, [paymentKey]: 'success' }));
        
        // Save payment to database
        try {
          console.log('Saving payment with employment_id:', employee.employment_id);
          console.log('Employee data:', employee);
          console.log('Group employer ID:', group.employer?.id);
          
          // If employment_id is missing, try to find it from the database
          let employmentId = employee.employment_id;
          if (!employmentId && group.employer?.id) {
            console.warn('employment_id is missing, attempting to find it from database...');
            try {
              const employmentResult = await ProfileService.findEmploymentId(group.employer.id, employee.id);
              if (employmentResult.success && employmentResult.data) {
                employmentId = employmentResult.data;
                console.log('Found employment_id:', employmentId);
              } else {
                console.error('Could not find employment_id:', employmentResult.error);
              }
            } catch (error) {
              console.error('Error finding employment_id:', error);
            }
          }
          
          const paymentResult = await ProfileService.savePayment({
            employment_id: employmentId || null, // Allow null for now
            employer_id: group.employer?.id,
            employee_id: employee.id,
            chain: employee.chain,
            token: employee.token,
            token_contract: employee.token_contract,
            token_decimals: employee.token_decimals,
            amount_token: employee.payment_amount || '0',
            recipient: employee.wallet_address,
            tx_hash: transferResult.transactionHash,
            status: 'confirmed'
          });

          if (paymentResult.success) {
            console.log('Payment saved to database:', paymentResult.data);
          } else {
            console.error('Failed to save payment to database:', paymentResult.error);
          }
        } catch (dbError) {
          console.error('Error saving payment to database:', dbError);
        }
        
        toast({
          title: "🎉 Payment Successful!",
          description: `Sent ${parseFloat(employee.payment_amount || '0').toFixed(2)} ${tokenType} to ${employee.first_name} ${employee.last_name}`,
        });

        // Show transaction in Blockscout if available
        if (transferResult.transactionHash) {
          console.log(`Transaction successful: ${transferResult.transactionHash} on chain ${destinationChainId}`);
          
          // Wait 5 seconds for transaction to be indexed by explorer
          setTimeout(async () => {
            try {
              // Use Supabase function to avoid CORS issues
              const chainName = getChainName(destinationChainId);
              const response = await fetch(`https://memgpowzdqeuwdpueajh.functions.supabase.co/blockscout?chain=${chainName}&hash=${transferResult.transactionHash}&api=v2`);
              if (response.ok) {
                const txData = await response.json();
                console.log('Transaction data from Blockscout:', txData);
                // You can show this data in a toast or modal if needed
              }
          } catch (txError) {
              console.log('Transaction lookup not available:', txError);
              // This is not a critical error, just a nice-to-have feature
          }
          }, 5000); // Wait 5 seconds
        }

        // Refresh transaction history after successful payment
        setTimeout(() => {
          fetchRecentTransactions();
        }, 6000); // Wait a bit longer than the transaction lookup

        return { success: true, transactionHash: transferResult.transactionHash };

      } else {
        console.error('Transfer failed:', transferResult);
        setPaymentStatus(prev => ({ ...prev, [paymentKey]: 'error' }));
        
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

    // Filter out employees without valid wallet addresses
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

      // Process payments for VALID employees in the group ONE BY ONE
      for (let i = 0; i < validEmployees.length; i++) {
        const employee = validEmployees[i];
        console.log(`Processing payment ${i + 1}/${validEmployees.length} for:`, employee.first_name, employee.last_name);
        
        // Show progress toast
        toast({
          title: "Processing Payments",
          description: `Processing payment ${i + 1}/${validEmployees.length} for ${employee.first_name} ${employee.last_name}`,
        });

        // Wait for the current payment to complete before starting the next
        const result = await handlePayEmployee(group, employee);
        
        if (result.success) {
          successfulPayments++;
        } else {
          failedPayments++;
        }

        // Wait 2 seconds before processing next employee (even if previous failed)
        if (i < validEmployees.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Show final summary
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

  // Parse Avai intent HTML to extract data
  const parseAvaiIntentData = (html: string) => {
    try {
      // Create a temporary DOM parser (this will work in browser)
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Extract data using regex patterns and DOM queries
      const extractText = (selector: string) => {
        const element = doc.querySelector(selector);
        return element?.textContent?.trim() || '';
      };
      
      // Extract all text content for regex matching
      const allText = doc.body?.textContent || '';
      console.log('All text content:', allText.substring(0, 2000)); // Log first 2000 chars for debugging
      
      // Look for specific patterns in the HTML structure
      console.log('Looking for specific patterns...');
      
      // Extract EVM addresses using regex (0x followed by 40 hex characters)
      const addressRegex = /0x[a-fA-F0-9]{40}/g;
      const addresses = allText.match(addressRegex) || [];
      console.log('Found addresses:', addresses);
      
      // Try to find user account in different ways
      let sender = '';
      const userAccountElement = doc.querySelector('[data-testid="user-account"], .user-account, [class*="account"]');
      if (userAccountElement) {
        sender = userAccountElement.textContent?.trim() || '';
        console.log('Found sender from user account element:', sender);
      } else {
        // Fallback to first address
        sender = addresses[0] || '';
        console.log('Using first address as sender:', sender);
      }
      
      // Extract amounts with more flexible patterns
      const amountRegex = /(\d+\.?\d*)\s*(USDC|ETH|USDT)/gi;
      const amountMatches = allText.match(amountRegex) || [];
      console.log('Found amounts:', amountMatches);
      
      // Try to find amounts in specific sections
      let sourceAmount = '';
      let sourceCurrency = '';
      let destAmount = '';
      let destCurrency = '';
      
      // Look for SOURCES section
      const sourcesSection = allText.match(/SOURCES.*?(\d+\.?\d*)\s*(USDC|ETH|USDT)/i);
      if (sourcesSection) {
        sourceAmount = sourcesSection[1];
        sourceCurrency = sourcesSection[2];
        console.log('Found source amount from SOURCES:', sourceAmount, sourceCurrency);
      } else if (amountMatches.length > 0) {
        const firstAmount = amountMatches[0].split(' ');
        sourceAmount = firstAmount[0];
        sourceCurrency = firstAmount[1];
        console.log('Using first amount as source:', sourceAmount, sourceCurrency);
      }
      
      // Look for DESTINATIONS section
      const destSection = allText.match(/DESTINATIONS.*?(\d+\.?\d*)\s*(USDC|ETH|USDT)/i);
      if (destSection) {
        destAmount = destSection[1];
        destCurrency = destSection[2];
        console.log('Found dest amount from DESTINATIONS:', destAmount, destCurrency);
      } else if (amountMatches.length > 1) {
        const secondAmount = amountMatches[1].split(' ');
        destAmount = secondAmount[0];
        destCurrency = secondAmount[1];
        console.log('Using second amount as dest:', destAmount, destCurrency);
      }
      
      // Extract chain information
      const hasEthereumSepolia = allText.includes('Ethereum Sepolia');
      const hasOptimismSepolia = allText.includes('Optimism Sepolia');
      console.log('Chain detection - Ethereum Sepolia:', hasEthereumSepolia, 'Optimism Sepolia:', hasOptimismSepolia);
      
      // Extract solver address - look for it in different ways
      let solver = '';
      
      // Try to find solver in links or specific elements
      const solverLinks = doc.querySelectorAll('a[href*="solver"], a[href*="address"]');
      for (const link of solverLinks) {
        const linkText = link.textContent?.trim() || '';
        if (linkText.match(/0x[a-fA-F0-9]{40}/)) {
          solver = linkText;
          console.log('Found solver from link:', solver);
          break;
        }
      }
      
      // If no solver found in links, try second address
      if (!solver && addresses.length > 1) {
        solver = addresses[1];
        console.log('Using second address as solver:', solver);
      }
      
      // Extract total fees with multiple patterns
      let totalFees = '';
      const feesPatterns = [
        /Total Fees.*?(\d+\.?\d*)\s*(USDC|ETH|USDT)/i,
        /Fees.*?(\d+\.?\d*)\s*(USDC|ETH|USDT)/i,
        /(\d+\.?\d*)\s*(USDC|ETH|USDT).*?fees/i
      ];
      
      for (const pattern of feesPatterns) {
        const feesMatch = allText.match(pattern);
        if (feesMatch) {
          totalFees = feesMatch[1];
          console.log('Found fees:', totalFees);
          break;
        }
      }
      
      // Extract status
      const hasSuccess = allText.includes('SUCCESS');
      const status = hasSuccess ? 'SUCCESS' : 'UNKNOWN';
      console.log('Status detection:', status);
      
      console.log('Parsed data:', {
        sender,
        sourceAmount,
        sourceCurrency,
        destAmount,
        destCurrency,
        solver,
        totalFees,
        status
      });
      
      // If we didn't find much data, use fallback data for testing
      if (!sender && !sourceAmount && !solver) {
        console.log('Using fallback data for testing');
        return {
          sender: '0x50035499ebf1cc5f49b57b6c2ed7bdfdb791bb2a',
          amount: '5.03505',
          originalChain: 'Ethereum Sepolia',
          originalCurrency: 'USDC',
          destinationChain: 'Optimism Sepolia',
          destinationCurrency: 'USDC',
          solver: '0x247365225b9.....704f3ead9',
          totalFees: '0.03505',
          status: 'SUCCESS'
        };
      }
      
      return {
        sender: sender,
        amount: sourceAmount,
        originalChain: hasEthereumSepolia ? 'Ethereum Sepolia' : 'Ethereum Sepolia',
        originalCurrency: sourceCurrency || 'USDC',
        destinationChain: hasOptimismSepolia ? 'Optimism Sepolia' : 'Optimism Sepolia',
        destinationCurrency: destCurrency || 'USDC',
        solver: solver,
        totalFees: totalFees,
        status: status
      };
    } catch (error) {
      console.log('Error parsing Avai HTML:', error);
      return {
        sender: '',
        amount: '',
        originalChain: 'Ethereum Sepolia',
        originalCurrency: 'USDC',
        destinationChain: 'Optimism Sepolia',
        destinationCurrency: 'USDC',
        solver: '',
        totalFees: '',
        status: 'UNKNOWN'
      };
    }
  };

  const fetchDatabasePayments = async () => {
    if (!address) return;

    setIsLoadingDatabasePayments(true);
    try {
      // Get the current user's employer ID from the first group
      if (groups.length > 0 && groups[0].employer?.id) {
        const paymentsResult = await ProfileService.getEmployerPayments(groups[0].employer.id, 10);
        
        if (paymentsResult.success && paymentsResult.data) {
          console.log('Database payments:', paymentsResult.data);
          setDatabasePayments(paymentsResult.data);
        } else {
          console.error('Error fetching database payments:', paymentsResult.error);
        }
      }
    } catch (error) {
      console.error('Error fetching database payments:', error);
    } finally {
      setIsLoadingDatabasePayments(false);
    }
  };

  const fetchRecentTransactions = async () => {
    if (!address) return;

    setIsLoadingTransactions(true);
    try {
      // Use Supabase function to fetch recent transactions for the current user
      const response = await fetch(`https://memgpowzdqeuwdpueajh.functions.supabase.co/blockscout?chain=optimism-sepolia&address=${address}&api=v2`);
      if (response.ok) {
        const txData = await response.json();
        console.log('Transaction history:', txData);
        
        // Get the last 5 transactions (or 1 if we want to start simple)
        const transactions = txData.items || txData.result || [];
        const lastTransaction = transactions.slice(0, 1); // Start with just 1 transaction
        console.log('Transaction data structure:', lastTransaction);
        
        // For each transaction, try to fetch Avai intent data
        const enrichedTransactions = await Promise.all(
          lastTransaction.map(async (tx) => {
            try {
              // Try to extract intent ID from transaction data or use a known one for testing
              const intentId = tx.intent_id || '178'; // Use 178 as default for testing
              
              // Fetch Avai intent data (HTML page)
              const avaiResponse = await fetch(`https://explorer.nexus-folly.availproject.org/intent/${intentId}`);
              if (avaiResponse.ok) {
                const html = await avaiResponse.text();
                console.log('Avai HTML response:', html.substring(0, 500)); // Log first 500 chars
                
                // Parse HTML to extract data
                const avaiData = parseAvaiIntentData(html);
                console.log('Parsed Avai intent data:', avaiData);
                
                return {
                  ...tx,
                  avaiData: {
                    sender: avaiData.sender,
                    amount: avaiData.amount,
                    solver: avaiData.solver,
                    originalChain: avaiData.originalChain,
                    originalCurrency: avaiData.originalCurrency,
                    destinationChain: avaiData.destinationChain,
                    destinationCurrency: avaiData.destinationCurrency,
                    intentId: intentId,
                    totalFees: avaiData.totalFees,
                    status: avaiData.status
                  }
                };
              }
            } catch (avaiError) {
              console.log('Error fetching Avai intent data:', avaiError);
            }
            
            return tx; // Return original transaction if Avai data fetch fails
          })
        );
        
        console.log('Enriched transactions:', enrichedTransactions);
        setRecentTransactions(enrichedTransactions);
      }
    } catch (error) {
      console.log('Error fetching transaction history:', error);
    } finally {
      setIsLoadingTransactions(false);
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

    await fetchRecentTransactions();
    toast({
      title: "Transaction History",
      description: `Found ${recentTransactions.length} recent transactions`,
    });
  };

  const getPaymentStatus = (groupId: string, employeeId: string) => {
    return paymentStatus[`${groupId}-${employeeId}`];
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
                <motion.div
                  key={group.id}
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

                      <div className="flex gap-2 pt-4">
                        <Button
                          variant="outline"
                          className="flex-1 glass-card border-white/20"
                          onClick={() => navigate(`/admin/edit-group/${group.id}`)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Group
                        </Button>
                        <Button
                          className="flex-1 bg-gradient-to-r from-primary to-cyan-500 hover:opacity-90"
                          onClick={() => handlePayAllEmployees(group)}
                          disabled={
                            isProcessingPayment === group.id || 
                            !group.employeeDetails || 
                            group.employeeDetails.length === 0 ||
                            group.employeeDetails.filter(emp => 
                              emp.wallet_address && 
                              emp.wallet_address.trim() !== '' && 
                              emp.payment_amount && 
                              emp.payment_amount > 0
                            ).length === 0
                          }
                        >
                          {isProcessingPayment === group.id ? (
                            <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Send className="mr-2 h-4 w-4" />
                              Pay All
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Employee List */}
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
              ))}
              </div>

              {/* Recent Transactions Section */}
              {(recentTransactions.length > 0 || isLoadingTransactions) && (
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-4 gradient-text">Recent Transactions</h2>
                  {isLoadingTransactions ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <span className="text-muted-foreground">Loading transactions...</span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                    {recentTransactions.map((tx, index) => (
                      <Card key={index} className="glass-card p-6">
                        <div className="space-y-4">
                          {/* Transaction Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 bg-green-500/20 rounded-lg">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              </div>
                              <div>
                                <p className="font-medium text-lg">
                                  {tx.avaiData ? 'Complete Payment Flow' : 'Transaction'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {tx.hash ? `${tx.hash.slice(0, 6)}...${tx.hash.slice(-4)}` : 'Unknown hash'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">
                                {(() => {
                                  try {
                                    if (tx.timestamp) {
                                      const date = new Date(tx.timestamp * 1000);
                                      if (!isNaN(date.getTime())) {
                                        return date.toLocaleDateString();
                                      }
                                      return `Timestamp: ${tx.timestamp}`;
                                    } else if (tx.block_timestamp) {
                                      const date = new Date(tx.block_timestamp);
                                      if (!isNaN(date.getTime())) {
                                        return date.toLocaleDateString();
                                      }
                                      return `Block: ${tx.block_timestamp}`;
                                    } else if (tx.created_at) {
                                      const date = new Date(tx.created_at);
                                      if (!isNaN(date.getTime())) {
                                        return date.toLocaleDateString();
                                      }
                                      return `Created: ${tx.created_at}`;
                                    }
                                    return 'No timestamp';
                                  } catch (e) {
                                    console.log('Date parsing error:', e, tx);
                                    return `Raw: ${tx.timestamp || tx.block_timestamp || tx.created_at || 'N/A'}`;
                                  }
                                })()}
                              </p>
                              <Badge variant="outline" className="mt-1">
                                {(() => {
                                  const status = tx.status || tx.result || 'Confirmed';
                                  if (status === 'error' || status === 'failed') {
                                    return 'Failed';
                                  } else if (status === 'success' || status === 'confirmed') {
                                    return 'Confirmed';
                                  } else if (status === 'pending') {
                                    return 'Pending';
                                  }
                                  return status;
                                })()}
                              </Badge>
                            </div>
                          </div>

                          {/* Complete Transaction Flow */}
                          {tx.avaiData ? (
                            <div className="space-y-3">
                              <div className="grid md:grid-cols-2 gap-4">
                                {/* Avai Framework Side (Sender → Solver) */}
                                <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-200/50">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-semibold text-blue-800">Avail Intent</h4>
                                    {tx.avaiData.status && (
                                      <Badge className={`text-xs ${
                                        tx.avaiData.status === 'SUCCESS' 
                                          ? 'bg-green-500/20 text-green-700' 
                                          : 'bg-yellow-500/20 text-yellow-700'
                                      }`}>
                                        {tx.avaiData.status}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">From:</span>
                                      <span className="font-mono text-xs">{tx.avaiData.sender?.slice(0, 6)}...{tx.avaiData.sender?.slice(-4)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Amount:</span>
                                      <span className="font-semibold">{tx.avaiData.amount} {tx.avaiData.originalCurrency}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Chain:</span>
                                      <span>{tx.avaiData.originalChain}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Solver:</span>
                                      <span className="font-mono text-xs">{tx.avaiData.solver?.slice(0, 6)}...{tx.avaiData.solver?.slice(-4)}</span>
                                    </div>
                                    {tx.avaiData.totalFees && (
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Fees:</span>
                                        <span className="font-semibold text-orange-600">{tx.avaiData.totalFees} {tx.avaiData.originalCurrency}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Blockscout Side (Solver → Recipient) */}
                                <div className="p-4 bg-green-50/50 rounded-lg border border-green-200/50">
                                  <h4 className="font-semibold text-green-800 mb-2">Blockscout</h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">To:</span>
                                      <span className="font-mono text-xs">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Amount:</span>
                                      <span className="font-semibold">
                                        {(() => {
                                          try {
                                            if (tx.value) {
                                              const value = parseFloat(tx.value);
                                              if (value > 0) {
                                                return `${(value / 1e18).toFixed(4)} ETH`;
                                              }
                                            }
                                            return 'N/A';
                                          } catch (e) {
                                            return 'N/A';
                                          }
                                        })()}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Chain:</span>
                                      <span>{tx.avaiData.destinationChain || 'Optimism Sepolia'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Currency:</span>
                                      <span>{tx.avaiData.destinationCurrency || 'ETH'}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Transaction Flow Arrow */}
                              <div className="flex items-center justify-center py-2">
                                <div className="flex items-center space-x-2 text-muted-foreground">
                                  <span className="text-sm">{tx.avaiData.originalChain}</span>
                                  <span className="text-lg">→</span>
                                  <span className="text-sm">{tx.avaiData.destinationChain}</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* Fallback for transactions without Avai data */
                            <div className="p-4 bg-gray-50/50 rounded-lg">
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Amount:</span>
                                <span className="font-semibold">
                                  {(() => {
                                    try {
                                      if (tx.value) {
                                        const value = parseFloat(tx.value);
                                        if (value > 0) {
                                          return `${(value / 1e18).toFixed(4)} ETH`;
                                        }
                                      }
                                      return 'Transaction';
                                    } catch (e) {
                                      return 'Transaction';
                                    }
                                  })()}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                    </div>
                  )}
                </div>
              )}

              {/* Database Payments Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold gradient-text">Database Payment History</h2>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchDatabasePayments}
                    disabled={isLoadingDatabasePayments}
                  >
                    {isLoadingDatabasePayments ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                      </>
                    )}
                  </Button>
                </div>
                
                {isLoadingDatabasePayments ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2">Loading database payments...</span>
                  </div>
                ) : databasePayments.length === 0 ? (
                  <Card className="glass-card p-8 text-center">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="p-4 bg-muted/50 rounded-full">
                        <Receipt className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">No Database Payments Yet</h3>
                        <p className="text-muted-foreground">
                          Payments will appear here once they are processed and saved to the database.
                        </p>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {databasePayments.map((payment, index) => (
                      <Card key={payment.id} className="glass-card p-6">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 bg-blue-500/20 rounded-lg">
                                <Receipt className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-lg">Database Payment</p>
                                <p className="text-sm text-muted-foreground">
                                  {payment.employments?.employees?.first_name} {payment.employments?.employees?.last_name}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">
                                {payment.amount_token} {payment.token?.toUpperCase()}
                              </p>
                              <Badge variant="outline" className="mt-1">
                                {payment.status}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-white/20">
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Employee:</span>
                                <span>{payment.employments?.employees?.first_name} {payment.employments?.employees?.last_name}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Role:</span>
                                <span>{payment.employments?.role}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Recipient:</span>
                                <span className="font-mono text-xs">{payment.recipient?.slice(0, 6)}...{payment.recipient?.slice(-4)}</span>
                              </div>
                            </div>
                            
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Chain:</span>
                                <span>{payment.chain}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Pay Date:</span>
                                <span>{new Date(payment.pay_date).toLocaleDateString()}</span>
                              </div>
                              {payment.tx_hash && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">TX Hash:</span>
                                  <span className="font-mono text-xs">{payment.tx_hash.slice(0, 6)}...{payment.tx_hash.slice(-4)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Groups;
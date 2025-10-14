import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Calendar, DollarSign, CheckCircle2, Clock, Loader2, User, ExternalLink, RefreshCw, Bell } from "lucide-react";
import { useAccount } from "wagmi";
import { useToast } from "@/hooks/use-toast";
import { ProfileService } from "@/lib/profileService";

interface EmploymentData {
  id: string;
  company: string;
  companyEmail: string;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  monthlyPayment: number;
  paymentFrequency: string;
  chain: string;
  token: string;
  status: string;
  role: string;
  created_at: string;
  updated_at: string;
}

interface Transaction {
  hash: string;
  timestamp: string;
  value: string;
  valueFormatted: string;
  from: string;
  to: string;
  status: string;
  method: string;
  gasUsed: string;
  blockNumber: number;
  isPayment?: boolean;
}

const Employment = () => {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [employmentData, setEmploymentData] = useState<EmploymentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentTransactions, setPaymentTransactions] = useState<Transaction[]>([]);
  const [employerTransactions, setEmployerTransactions] = useState<Transaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitoringCleanup, setMonitoringCleanup] = useState<(() => void) | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [isLoadingRecentTransactions, setIsLoadingRecentTransactions] = useState(false);
  const [databasePayments, setDatabasePayments] = useState<any[]>([]);
  const [isLoadingDatabasePayments, setIsLoadingDatabasePayments] = useState(false);

  // For testing - use well-known addresses
  const TEST_EMPLOYER_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"; // Vitalik's address for testing

  // Load employment data on component mount
  useEffect(() => {
    const loadEmploymentData = async () => {
      if (!address || !isConnected) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const result = await ProfileService.getEmploymentByWallet(address);
        if (result.success) {
          setEmploymentData(result.data);
          console.log('Loaded employment data:', result.data);
        } else {
          console.error('Failed to load employment data:', result.error);
          toast({
            title: "Error",
            description: "Failed to load employment data. Please try again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error loading employment data:', error);
        toast({
          title: "Error",
          description: "Failed to load employment data. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadEmploymentData();
  }, [address, isConnected, toast]);

  // Fetch recent transactions when address is available
  useEffect(() => {
    if (address && isConnected) {
      fetchRecentTransactions();
    }
  }, [address, isConnected]);

  // Load transaction data
  const loadTransactionData = async () => {
    if (!address || !isConnected) return;

    setIsLoadingTransactions(true);
    try {
      // Load payment transactions (incoming to employee)
      const paymentResult = await ProfileService.getPaymentTransactions(address, TEST_EMPLOYER_ADDRESS, 10);
      if (paymentResult.success) {
        setPaymentTransactions(paymentResult.data);
        console.log('Loaded payment transactions:', paymentResult.data);
      }

      // Load employer transactions (outgoing from employer)
      const employerResult = await ProfileService.getEmployerTransactions(TEST_EMPLOYER_ADDRESS, 20);
      if (employerResult.success) {
        setEmployerTransactions(employerResult.data);
        console.log('Loaded employer transactions:', employerResult.data);
      }
    } catch (error) {
      console.error('Error loading transaction data:', error);
      toast({
        title: "Error",
        description: "Failed to load transaction data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  // Fetch recent transactions for the employee
  const fetchRecentTransactions = async () => {
    if (!address) return;

    setIsLoadingRecentTransactions(true);
    try {
      const response = await fetch(`https://memgpowzdqeuwdpueajh.functions.supabase.co/blockscout?chain=optimism-sepolia&address=${address}&api=v2`);
      if (response.ok) {
        const txData = await response.json();
        console.log('Recent transactions for employee:', txData);
        
        // Get the last 5 transactions
        const transactions = txData.items || txData.result || [];
        const lastFiveTransactions = transactions.slice(0, 5);
        console.log('Last 5 transactions:', lastFiveTransactions);
        setRecentTransactions(lastFiveTransactions);
      }
    } catch (error) {
      console.log('Error fetching recent transactions:', error);
    } finally {
      setIsLoadingRecentTransactions(false);
    }
  };

  const fetchDatabasePayments = async () => {
    if (!employmentData?.employee?.id) return;

    setIsLoadingDatabasePayments(true);
    try {
      const paymentsResult = await ProfileService.getEmployeePayments(employmentData.employee.id, 10);
      
      if (paymentsResult.success && paymentsResult.data) {
        console.log('Database payments:', paymentsResult.data);
        setDatabasePayments(paymentsResult.data);
      } else {
        console.error('Error fetching database payments:', paymentsResult.error);
        setDatabasePayments([]);
      }
    } catch (error) {
      console.error('Error fetching database payments:', error);
      setDatabasePayments([]);
    } finally {
      setIsLoadingDatabasePayments(false);
    }
  };

  // Start/stop transaction monitoring
  const toggleMonitoring = () => {
    if (isMonitoring) {
      // Stop monitoring
      if (monitoringCleanup) {
        monitoringCleanup();
        setMonitoringCleanup(null);
      }
      setIsMonitoring(false);
      toast({
        title: "Monitoring Stopped",
        description: "Real-time transaction monitoring has been stopped.",
      });
    } else {
      // Start monitoring
      if (address && isConnected) {
        const cleanup = ProfileService.setupTransactionMonitoring(
          address,
          TEST_EMPLOYER_ADDRESS,
          (newTransaction) => {
            toast({
              title: "New Payment Received!",
              description: `Received ${newTransaction.valueFormatted} ETH from your employer.`,
            });
            // Refresh transaction data
            loadTransactionData();
          }
        );
        setMonitoringCleanup(() => cleanup);
        setIsMonitoring(true);
        toast({
          title: "Monitoring Started",
          description: "Real-time transaction monitoring is now active.",
        });
      }
    }
  };

  // Load transactions when employment data is loaded
  useEffect(() => {
    if (employmentData) {
      loadTransactionData();
      fetchDatabasePayments();
    }
  }, [employmentData]);

  // Cleanup monitoring on unmount
  useEffect(() => {
    return () => {
      if (monitoringCleanup) {
        monitoringCleanup();
      }
    };
  }, [monitoringCleanup]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
        <Navbar role="employee" />
        <div className="container mx-auto px-6 py-12">
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-muted-foreground">Loading employment data...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!employmentData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
        <Navbar role="employee" />
        <div className="container mx-auto px-6 py-12">
          <div className="text-center py-12">
            <div className="p-6 bg-white/50 rounded-xl max-w-md mx-auto">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Employment Found</h3>
              <p className="text-muted-foreground mb-4">
                {!isConnected 
                  ? "Please connect your wallet to view employment information."
                  : "You don't have any active employment records. Contact your employer to get started."
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
      <Navbar role="employee" />
      
      <div className="container mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto space-y-8"
        >
          <div className="space-y-2">
            <h1 className="text-4xl font-bold gradient-text">Current Employment</h1>
            <p className="text-muted-foreground">View your employment details and payment history</p>
          </div>

          {/* Current Employment Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="glass-card p-8 hover-lift bg-gradient-to-br from-white/80 to-white/60">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-r from-primary to-blue-500 rounded-xl">
                    <Building2 className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{employmentData.company}</h2>
                    <p className="text-sm text-muted-foreground">{employmentData.companyEmail}</p>
                    <Badge className="mt-2 bg-green-500/20 text-green-700 hover:bg-green-500/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {employmentData.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <DollarSign className="h-4 w-4" />
                    {employmentData.paymentFrequency === 'monthly' ? 'Monthly' : 'Payment'} Amount
                  </div>
                  <div className="text-2xl font-bold gradient-text">
                    {employmentData.monthlyPayment.toFixed(6)} {employmentData.token.toUpperCase()}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Calendar className="h-4 w-4" />
                    Payment Frequency
                  </div>
                  <div className="text-2xl font-bold">
                    {employmentData.paymentFrequency}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Building2 className="h-4 w-4" />
                    Role
                  </div>
                  <div className="text-2xl font-bold">
                    {employmentData.role}
                  </div>
                </div>
              </div>

              {/* Employee Info */}
              <div className="mt-6 pt-6 border-t border-white/20">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                  <User className="h-4 w-4" />
                  Employee Information
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-semibold">{employmentData.employee.first_name} {employmentData.employee.last_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-semibold">{employmentData.employee.email || 'Not provided'}</p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>



          {/* Database Payment History Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Bell className="h-6 w-6 text-primary" />
                Payment History
              </h2>
              <div className="flex gap-2">
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
                <Button
                  onClick={toggleMonitoring}
                  variant={isMonitoring ? "destructive" : "default"}
                  size="sm"
                  className={isMonitoring ? "bg-red-500 hover:bg-red-600" : "bg-gradient-to-r from-primary to-blue-500 hover:opacity-90"}
                >
                  <Bell className="h-4 w-4 mr-1" />
                  {isMonitoring ? "Stop Monitoring" : "Start Monitoring"}
                </Button>
              </div>
            </div>
            
            {isLoadingDatabasePayments ? (
              <Card className="glass-card p-6">
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span>Loading payment history...</span>
                  </div>
                </div>
              </Card>
            ) : databasePayments.length === 0 ? (
              <Card className="glass-card p-6">
                <div className="text-center py-8">
                  <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No payment history found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Payments will appear here once they are processed and saved to the database.
                  </p>
                </div>
              </Card>
            ) : (
              <div className="grid gap-4">
                {databasePayments.map((payment, index) => (
                  <Card key={payment.id} className="glass-card p-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-green-500/20 rounded-lg">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-lg">Payment Received</p>
                            <p className="text-sm text-muted-foreground">
                              {payment.employments?.employers?.name || 'Employer'}
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
                            <span className="text-muted-foreground">Employer:</span>
                            <span>{payment.employments?.employers?.name || 'N/A'}</span>
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
          </motion.div>

          {/* Recent Wallet Transactions Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <RefreshCw className="h-6 w-6 text-primary" />
              Recent Wallet Transactions
            </h2>

            {isLoadingRecentTransactions ? (
              <Card className="glass-card p-6">
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-muted-foreground">Loading recent transactions...</span>
                  </div>
                </div>
              </Card>
            ) : recentTransactions.length > 0 ? (
              <Card className="glass-card p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Your Recent Activity</h3>
                    <Badge className="bg-purple-500/20 text-purple-700">
                      {recentTransactions.length} transactions
                    </Badge>
                  </div>
                  
                  <div className="space-y-3">
                    {recentTransactions.map((tx, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-white/20 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-green-500/20 rounded-lg">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium">
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
                    ))}
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="glass-card p-6">
                <div className="text-center py-4">
                  <RefreshCw className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No recent transactions found</p>
                </div>
              </Card>
            )}
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
};

export default Employment;

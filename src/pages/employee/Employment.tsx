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
import { BridgeAndSwapComponent } from '@/components/BridgeAndSwapComponent';

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
  // Multiple employment support
  hasMultipleEmployments?: boolean;
  totalEmployments?: number;
  otherEmployments?: Array<{
    id: string;
    company: string;
    companyEmail: string;
    monthlyPayment: number;
    paymentFrequency: string;
    chain: string;
    token: string;
    status: string;
    role: string;
    created_at: string;
  }>;
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
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitoringCleanup, setMonitoringCleanup] = useState<(() => void) | null>(null);
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

  // No longer needed - we use real-time database monitoring instead



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


  // Load payments and start monitoring when employment data is loaded
  useEffect(() => {
    if (employmentData) {
      fetchDatabasePayments();
      
      // Automatically start monitoring for new payments
      if (address && isConnected) {
        console.log('🔔 Auto-starting payment monitoring...');
        const cleanup = ProfileService.setupTransactionMonitoring(
          address,
          employmentData.companyEmail, // Using company email as identifier
          (newTransaction) => {
            toast({
              title: "💰 New Payment Received!",
              description: `Received ${newTransaction.valueFormatted} from your employer.`,
            });
            // Refresh payment data
            fetchDatabasePayments();
          }
        );
        
        // Store cleanup function
        setMonitoringCleanup(() => cleanup);
        setIsMonitoring(true);
      }
    }
  }, [employmentData, address, isConnected, toast]);

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
          <motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.5 }}
>
  <BridgeAndSwapComponent />
</motion.div>
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

          {/* All Employments */}
          <div className="space-y-6">
            {/* Primary Employment */}
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
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className="bg-green-500/20 text-green-700 hover:bg-green-500/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {employmentData.status}
                          </Badge>
                          <Badge variant="outline" className="bg-blue-500/20 text-blue-700">
                            {employmentData.role}
                          </Badge>
                        </div>
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
                        Chain
                      </div>
                      <div className="text-2xl font-bold capitalize">
                        {employmentData.chain}
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

              {/* Other Employments */}
              {employmentData.hasMultipleEmployments && employmentData.otherEmployments && employmentData.otherEmployments.map((employment, index) => (
                <motion.div
                  key={employment.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                >
                  <Card className="glass-card p-8 hover-lift bg-gradient-to-br from-white/80 to-white/60">
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl">
                          <Building2 className="h-8 w-8 text-white" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold">{employment.company}</h2>
                          <p className="text-sm text-muted-foreground">{employment.companyEmail}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge className="bg-green-500/20 text-green-700 hover:bg-green-500/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {employment.status}
                            </Badge>
                            <Badge variant="outline" className="bg-blue-500/20 text-blue-700">
                              {employment.role}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <DollarSign className="h-4 w-4" />
                          {employment.paymentFrequency === 'monthly' ? 'Monthly' : 'Payment'} Amount
                        </div>
                        <div className="text-2xl font-bold gradient-text">
                          {employment.monthlyPayment.toFixed(6)} {employment.token.toUpperCase()}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <Calendar className="h-4 w-4" />
                          Payment Frequency
                        </div>
                        <div className="text-2xl font-bold">
                          {employment.paymentFrequency}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <Building2 className="h-4 w-4" />
                          Chain
                        </div>
                        <div className="text-2xl font-bold capitalize">
                          {employment.chain}
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

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
                {isMonitoring && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-700 rounded-md text-sm">
                    <Bell className="h-4 w-4" />
                    Live Monitoring Active
                  </div>
                )}
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
                          {payment.intent_id && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Intent ID:</span>
                              <span className="font-mono text-xs">{payment.intent_id}</span>
                            </div>
                          )}
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
                          {payment.deposit_solver_address && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Deposit Solver:</span>
                              <span className="font-mono text-xs">{payment.deposit_solver_address.slice(0, 6)}...{payment.deposit_solver_address.slice(-4)}</span>
                            </div>
                          )}
                          {payment.first_tx_hash && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Deposit TX:</span>
                              <span className="font-mono text-xs">{payment.first_tx_hash.slice(0, 6)}...{payment.first_tx_hash.slice(-4)}</span>
                            </div>
                          )}
                          {payment.tx_hash && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Transfer TX:</span>
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

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.5 }}
>
  <BridgeAndSwapComponent />
</motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Employment;


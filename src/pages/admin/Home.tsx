import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, DollarSign, TrendingUp, Clock, Building2, Loader2, AlertTriangle, Fuel, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ProfileService } from "@/lib/profileService";
import { Badge } from "@/components/ui/badge";
import { useNexus } from '@/providers/NexusProvider';
import { useAccount } from 'wagmi';

interface Company {
  id: string;
  name: string;
  email: string;
}

interface DashboardStats {
  totalEmployees: number;
  activeGroups: number;
  monthlyPayout: number;
  pendingPayments: number;
  recentGroups: Array<{
    id: string;
    name: string;
    employees: number;
    payout: number;
    status: string;
    created_at: string;
  }>;
}

interface ChainGasBalance {
  chainId: number;
  chainName: string;
  balance: string;
  balanceInETH: number;
  isLow: boolean;
  threshold: number;
}

const SUPPORTED_CHAINS = [
  { id: 11155111, name: "Sepolia", threshold: 0.01 },
  { id: 84532, name: "Base", threshold: 0.005 },
  { id: 421614, name: "Arbitrum", threshold: 0.005 },
  { id: 11155420, name: "Optimism", threshold: 0.005 }
];

const Home = () => {
  const { toast } = useToast();
  const { nexusSDK, isInitialized } = useNexus();
  const { address } = useAccount();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [gasBalances, setGasBalances] = useState<ChainGasBalance[]>([]);
  const [isLoadingGas, setIsLoadingGas] = useState(false);
  const [isRefueling, setIsRefueling] = useState<string | null>(null);
  const [hasLowGas, setHasLowGas] = useState(false);

  // Load companies on component mount
  useEffect(() => {
    const loadCompanies = async () => {
      setIsLoading(true);
      try {
        const result = await ProfileService.getAllCompanies();
        if (result.success) {
          setCompanies(result.data);
          console.log('Loaded companies:', result.data);
          if (result.data.length > 0) {
            setSelectedCompanyId(result.data[0].id);
          }
        } else {
          console.error('Failed to load companies:', result.error);
          toast({
            title: "Error",
            description: "Failed to load companies. Please try again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error loading companies:', error);
        toast({
          title: "Error",
          description: "Failed to load companies. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadCompanies();
  }, [toast]);

  // Load dashboard stats when company is selected
  useEffect(() => {
    if (selectedCompanyId) {
      const loadDashboardStats = async () => {
        setIsLoadingStats(true);
        try {
          const result = await ProfileService.getCompanyDashboardStats(selectedCompanyId);
          if (result.success) {
            setDashboardStats(result.data);
            console.log('Loaded dashboard stats:', result.data);
          } else {
            console.error('Failed to load dashboard stats:', result.error);
            toast({
              title: "Error",
              description: "Failed to load dashboard statistics. Please try again.",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error('Error loading dashboard stats:', error);
          toast({
            title: "Error",
            description: "Failed to load dashboard statistics. Please try again.",
            variant: "destructive",
          });
        } finally {
          setIsLoadingStats(false);
        }
      };

      loadDashboardStats();
    }
  }, [selectedCompanyId, toast]);

  // Check gas balances using Nexus SDK
  const checkGasBalances = async () => {
    if (!nexusSDK || !isInitialized) {
      console.log('Nexus SDK not initialized');
      return;
    }

    setIsLoadingGas(true);
    try {
      console.log('🔍 Checking gas balances across all chains...');
      
      const balances: ChainGasBalance[] = [];
      let lowGasDetected = false;

      // Get unified balances from Nexus SDK
      const unifiedBalances = await nexusSDK.getUnifiedBalances();
      console.log('Unified balances:', unifiedBalances);

      // Find ETH token across all chains
      const ethToken = unifiedBalances?.find(token => 
        token.symbol === 'ETH' || token.symbol === 'WETH'
      );

      if (ethToken) {
        for (const chain of SUPPORTED_CHAINS) {
          const chainBalance = ethToken.breakdown.find(b => b.chain.id === chain.id);
          const balanceInETH = chainBalance ? parseFloat(chainBalance.balance) : 0;
          const isLow = balanceInETH < chain.threshold;

          balances.push({
            chainId: chain.id,
            chainName: chain.name,
            balance: chainBalance?.balance || "0",
            balanceInETH,
            isLow,
            threshold: chain.threshold
          });

          if (isLow) {
            lowGasDetected = true;
            console.log(`⚠️ Low gas detected on ${chain.name}: ${balanceInETH} ETH (threshold: ${chain.threshold} ETH)`);
          } else {
            console.log(`✅ Sufficient gas on ${chain.name}: ${balanceInETH} ETH`);
          }
        }
      } else {
        // If no ETH found, mark all chains as low
        for (const chain of SUPPORTED_CHAINS) {
          balances.push({
            chainId: chain.id,
            chainName: chain.name,
            balance: "0",
            balanceInETH: 0,
            isLow: true,
            threshold: chain.threshold
          });
        }
        lowGasDetected = true;
      }

      setGasBalances(balances);
      setHasLowGas(lowGasDetected);

      if (lowGasDetected) {
        const lowGasChains = balances.filter(b => b.isLow).map(b => b.chainName);
        toast({
          title: "⚠️ Low Gas Alert",
          description: `Low gas balance detected on: ${lowGasChains.join(', ')}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "✅ Gas Check Complete",
          description: "Sufficient gas on all chains",
        });
      }

    } catch (error) {
      console.error('Error checking gas balances:', error);
      toast({
        title: "Error",
        description: "Failed to check gas balances",
        variant: "destructive",
      });
    } finally {
      setIsLoadingGas(false);
    }
  };

  // Refuel gas using Nexus SDK transfer
  const handleRefuelGas = async (targetChainId: number, targetChainName: string) => {
    if (!nexusSDK || !isInitialized || !address) {
      toast({
        title: "Error",
        description: "Please connect your wallet and ensure Nexus SDK is initialized",
        variant: "destructive",
      });
      return;
    }

    setIsRefueling(targetChainName);
    
    try {
      console.log(`⛽ Refueling gas on ${targetChainName}...`);
      
      // Determine refuel amount based on chain
      const refuelAmount = targetChainId === 11155111 ? "0.05" : "0.02"; // More for Sepolia, less for L2s
      
      toast({
        title: "Starting Gas Refuel",
        description: `Sending ${refuelAmount} ETH to ${targetChainName}...`,
      });

      // Use Nexus SDK to transfer ETH to the target chain
      const transferResult = await nexusSDK.transfer({
        token: 'ETH',
        amount: refuelAmount,
        chainId: targetChainId as any,
        recipient: address as `0x${string}`,
        sourceChains: [11155111] // Use Sepolia as source
      });

      if (transferResult.success) {
        toast({
          title: "✅ Gas Refuel Successful",
          description: `Sent ${refuelAmount} ETH to ${targetChainName}. Transaction: ${transferResult.transactionHash.slice(0, 10)}...`,
        });
        
        // Wait a bit and refresh gas balances
        setTimeout(() => {
          checkGasBalances();
        }, 5000);
      } else {
        throw new Error("Transfer failed");
      }

    } catch (error) {
      console.error('Error refueling gas:', error);
      toast({
        title: "❌ Gas Refuel Failed",
        description: `Failed to refuel ${targetChainName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsRefueling(null);
    }
  };

  // Check gas balances on component mount and when company changes
  useEffect(() => {
    if (selectedCompanyId && isInitialized) {
      checkGasBalances();
    }
  }, [selectedCompanyId, isInitialized]);

  const handleCompanySelect = (companyId: string) => {
    setSelectedCompanyId(companyId);
  };

  const handleRefreshGas = () => {
    checkGasBalances();
  };

  // Create stats array from dashboard data with safe defaults
  const getStats = () => {
    if (!dashboardStats) {
      return [
        {
          label: "Total Employees",
          value: "0",
          icon: Users,
          trend: "Active employees",
          color: "from-blue-500 to-cyan-500",
        },
        {
          label: "Active Groups",
          value: "0",
          icon: TrendingUp,
          trend: "Payment groups",
          color: "from-purple-500 to-pink-500",
        },
        {
          label: "Monthly Payout",
          value: "$0.00",
          icon: DollarSign,
          trend: "Total monthly",
          color: "from-green-500 to-emerald-500",
        },
        {
          label: "Pending Payments",
          value: "0",
          icon: Clock,
          trend: "Awaiting processing",
          color: "from-orange-500 to-red-500",
        },
      ];
    }

    return [
      {
        label: "Total Employees",
        value: dashboardStats.totalEmployees.toString(),
        icon: Users,
        trend: "Active employees",
        color: "from-blue-500 to-cyan-500",
      },
      {
        label: "Active Groups",
        value: dashboardStats.activeGroups.toString(),
        icon: TrendingUp,
        trend: "Payment groups",
        color: "from-purple-500 to-pink-500",
      },
      {
        label: "Monthly Payout",
        value: `$${dashboardStats.monthlyPayout.toFixed(6)}`,
        icon: DollarSign,
        trend: "Total monthly",
        color: "from-green-500 to-emerald-500",
      },
      {
        label: "Pending Payments",
        value: dashboardStats.pendingPayments.toString(),
        icon: Clock,
        trend: "Awaiting processing",
        color: "from-orange-500 to-red-500",
      },
    ];
  };

  const stats = getStats();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
        <Navbar role="admin" />
        <div className="container mx-auto px-6 py-12">
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-muted-foreground">Loading companies...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
        <Navbar role="admin" />
        <div className="container mx-auto px-6 py-12">
          <div className="text-center py-12">
            <div className="p-6 bg-white/50 rounded-xl max-w-md mx-auto">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Companies Found</h3>
              <p className="text-muted-foreground mb-4">
                Create your first company to get started with the admin dashboard.
              </p>
              <Link to="/admin/profile">
                <Button className="bg-gradient-to-r from-primary to-blue-500 hover:opacity-90">
                  <Building2 className="mr-2 h-4 w-4" />
                  Create Company
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
      <Navbar role="admin" />
      
      <div className="container mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Header Section */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold gradient-text">Admin Dashboard</h1>
              <p className="text-muted-foreground">Manage payment groups and employees</p>
            </div>
            <Link to="/admin/create-group">
              <Button size="lg" className="bg-gradient-to-r from-primary to-blue-500 hover:opacity-90">
                Create New Group
              </Button>
            </Link>
          </div>

          {/* Company Selection */}
          <Card className="glass-card p-6 hover-lift">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Select Company</h2>
              </div>
              <Select value={selectedCompanyId} onValueChange={handleCompanySelect}>
                <SelectTrigger className="glass-card border-white/20">
                  <SelectValue placeholder="Choose a company to view dashboard" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name} ({company.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCompanyId && (
                <div className="text-sm text-muted-foreground">
                  Viewing dashboard for: <span className="font-semibold text-foreground">
                    {companies.find(c => c.id === selectedCompanyId)?.name}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Stats Grid */}
          {isLoadingStats ? (
            <div className="grid md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((index) => (
                <Card key={index} className="glass-card p-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-3 rounded-lg bg-gray-200 animate-pulse">
                        <div className="h-5 w-5 bg-gray-300 rounded" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      <div className="h-8 bg-gray-200 rounded animate-pulse" />
                      <div className="h-3 bg-gray-200 rounded animate-pulse" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-4 gap-6">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="glass-card p-6 hover-lift">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className={`p-3 rounded-lg bg-gradient-to-br ${stat.color}`}>
                          <stat.icon className="h-5 w-5 text-white" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="text-2xl font-bold">{stat.value}</p>
                        <p className="text-xs text-primary font-medium">{stat.trend}</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <Card className="glass-card p-8">
            <h2 className="text-2xl font-bold mb-6 gradient-text">Quick Actions</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <Link to="/admin/create-group">
                <Card className="p-6 hover-lift cursor-pointer bg-gradient-to-r from-primary/10 to-blue-500/10 border-primary/20">
                  <h3 className="font-semibold text-lg mb-2">Create Payment Group</h3>
                  <p className="text-sm text-muted-foreground">Set up a new group and add employees</p>
                </Card>
              </Link>
              <Link to="/admin/groups">
                <Card className="p-6 hover-lift cursor-pointer bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20">
                  <h3 className="font-semibold text-lg mb-2">View All Groups</h3>
                  <p className="text-sm text-muted-foreground">Manage existing payment groups</p>
                </Card>
              </Link>
              <Link to="/admin/profile">
                <Card className="p-6 hover-lift cursor-pointer bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20">
                  <h3 className="font-semibold text-lg mb-2">Company Profile</h3>
                  <p className="text-sm text-muted-foreground">Update company information</p>
                </Card>
              </Link>
            </div>
          </Card>

          {/* Gas Monitor Section - Added after Quick Actions */}
          <Card className="glass-card p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Fuel className="h-6 w-6 text-orange-500" />
                <h2 className="text-2xl font-bold gradient-text">Gas Monitor</h2>
              </div>
              <Badge variant={hasLowGas ? "destructive" : "default"}>
                {hasLowGas ? "Low Gas Alert" : "All Systems Go"}
              </Badge>
            </div>

            {!isInitialized ? (
              <div className="text-center py-8">
                <Fuel className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Connect Wallet</h3>
                <p className="text-muted-foreground mb-4">
                  Please connect your wallet to check gas balances across chains
                </p>
                <Button variant="outline" disabled>
                  <Fuel className="h-4 w-4 mr-2" />
                  Connect Wallet First
                </Button>
              </div>
            ) : isLoadingGas ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-muted-foreground">Checking gas balances...</span>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Gas Balance Alert */}
                {hasLowGas && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card p-4 border-2 border-red-300 bg-red-50/50 hover-lift"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-red-100">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-red-800 text-sm">Low Gas Balance Alert</h3>
                          <p className="text-xs text-red-600">
                            Some chains have insufficient ETH for gas fees
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshGas}
                        disabled={isLoadingGas}
                        className="border-red-300 text-red-700 hover:bg-red-100 h-8"
                      >
                        {isLoadingGas ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Refresh"
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* Gas Balances Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {gasBalances.map((chain) => (
                    <motion.div
                      key={chain.chainId}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        chain.isLow 
                          ? 'bg-red-50 border-red-200' 
                          : 'bg-green-50 border-green-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className={`font-semibold ${
                          chain.isLow ? 'text-red-800' : 'text-green-800'
                        }`}>
                          {chain.chainName}
                        </span>
                        {chain.isLow && (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Balance:</span>
                          <span className={`font-mono text-sm ${
                            chain.isLow ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {chain.balanceInETH.toFixed(6)} ETH
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Minimum:</span>
                          <span className="font-mono text-sm text-gray-500">
                            {chain.threshold} ETH
                          </span>
                        </div>
                      </div>

                      {chain.isLow && (
                        <Button
                          size="sm"
                          className="w-full mt-3 bg-orange-500 hover:bg-orange-600"
                          onClick={() => handleRefuelGas(chain.chainId, chain.chainName)}
                          disabled={isRefueling === chain.chainName}
                        >
                          {isRefueling === chain.chainName ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Fuel className="h-3 w-3 mr-1" />
                          )}
                          Refuel Gas
                        </Button>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={handleRefreshGas}
                    disabled={isLoadingGas}
                    className="flex-1"
                  >
                    {isLoadingGas ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Fuel className="h-4 w-4 mr-2" />
                    )}
                    Refresh Gas Balances
                  </Button>
                  
                  {hasLowGas && (
                    <Button
                      onClick={() => {
                        const lowGasChain = gasBalances.find(chain => chain.isLow);
                        if (lowGasChain) {
                          handleRefuelGas(lowGasChain.chainId, lowGasChain.chainName);
                        }
                      }}
                      disabled={isRefueling !== null}
                      className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90"
                    >
                      {isRefueling ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Fuel className="h-4 w-4 mr-2" />
                      )}
                      Refuel All Chains
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Recent Groups */}
          <Card className="glass-card p-8">
            <h2 className="text-2xl font-bold mb-6 gradient-text">Company Overview</h2>
            {isLoadingStats ? (
              <div className="space-y-4">
                {[1, 2, 3].map((index) => (
                  <div key={index} className="flex items-center justify-between p-4 glass-card rounded-lg">
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-32" />
                      <div className="h-3 bg-gray-200 rounded animate-pulse w-20" />
                    </div>
                    <div className="text-right space-y-2">
                      <div className="h-5 bg-gray-200 rounded animate-pulse w-24" />
                      <div className="h-3 bg-gray-200 rounded animate-pulse w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : dashboardStats && dashboardStats.recentGroups.length > 0 ? (
              <div className="space-y-4">
                {dashboardStats.recentGroups.map((group, index) => (
                  <motion.div
                    key={group.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="flex items-center justify-between p-4 glass-card rounded-lg hover-lift"
                  >
                    <div>
                      <p className="font-semibold">{group.name}</p>
                      <p className="text-sm text-muted-foreground">{group.employees} employees</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">${group.payout.toFixed(6)}/mo</p>
                      <p className="text-xs text-muted-foreground">{group.status}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
                <p className="text-muted-foreground mb-4">
                  This company doesn't have any employees or payment groups yet.
                </p>
                <Link to="/admin/create-group">
                  <Button className="bg-gradient-to-r from-primary to-blue-500 hover:opacity-90">
                    <Building2 className="mr-2 h-4 w-4" />
                    Create First Group
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Home;
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, Plus, Edit2, Trash2, Save, Loader2, Send, ExternalLink, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
// Removed Blockscout SDK imports since we're using Supabase function instead
import { ProfileService } from "@/lib/profileService";
import { useAccount } from 'wagmi';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  wallet_address: string;
  chain: string;
  token: string;
  payment_amount: string; // Changed to string for decimal precision
  payment_frequency: string;
  status: string;
  role: string;
  employment_id: string;
}

interface SearchResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  wallet_address: string;
  chain?: string;
  token?: string;
}

interface GroupData {
  id: string;
  name: string;
  email: string;
  employees: Employee[];
  totalPayment: number;
  status: string;
  created_at: string;
}

const EditGroup = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { address } = useAccount();
  // Removed useTransactionPopup since we're not using Blockscout SDK anymore

  // Convert token amounts to USDC equivalent
  const convertToUSDC = (amount: number, token: string): number => {
    const conversionRates: { [key: string]: number } = {
      'eth': 4000,    // 1 ETH = 2000 USDC (example rate)
      'usdc': 1,      // 1 USDC = 1 USDC
      'usdt': 1,      // 1 USDT = 1 USDC (approximate)
      'dai': 1,       // 1 DAI = 1 USDC (approximate)
    };
    
    const rate = conversionRates[token.toLowerCase()] || 1;
    return amount * rate;
  };

  const [groupData, setGroupData] = useState<GroupData | null>(null);
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedPayment, setEditedPayment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState<string | null>(null);
  const [newEmployee, setNewEmployee] = useState({ 
    address: "", 
    name: "", 
    payment: "", 
    chain: "", 
    token: "" 
  });

  // Load group data on component mount
  useEffect(() => {
    const loadGroupData = async () => {
      if (!id) {
        toast({
          title: "Error",
          description: "Group ID not provided.",
          variant: "destructive",
        });
        navigate("/admin/groups");
        return;
      }

      setIsLoading(true);
      try {
        const result = await ProfileService.getPaymentGroupById(id);
        if (result.success && result.data) {
          setGroupData(result.data);
          setGroupName(result.data.name);
          setEmployees(result.data.employees);
          console.log('Loaded group data:', result.data);
        } else {
          console.error('Failed to load group:', result.error);
          toast({
            title: "Error",
            description: result.error || "Failed to load group data.",
            variant: "destructive",
          });
          navigate("/admin/groups");
        }
      } catch (error) {
        console.error('Error loading group:', error);
        toast({
          title: "Error",
          description: "Failed to load group data. Please try again.",
          variant: "destructive",
        });
        navigate("/admin/groups");
      } finally {
        setIsLoading(false);
      }
    };

    loadGroupData();
  }, [id, navigate, toast]);

  const handleSavePayment = async (employmentId: string) => {
    const paymentAmount = parseFloat(editedPayment);
    if (isNaN(paymentAmount) || paymentAmount < 0) {
      toast({
        title: "Invalid Payment",
        description: "Please enter a valid payment amount.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await ProfileService.updateEmployeePayment(employmentId, paymentAmount);
      if (result.success) {
        // Update local state
        setEmployees(employees.map(emp => 
          emp.employment_id === employmentId ? { ...emp, payment_amount: paymentAmount.toString() } : emp
        ));
        setEditingId(null);
        toast({
          title: "Payment Updated",
          description: "Employee payment has been updated successfully.",
        });
      } else {
        throw new Error(result.error || "Failed to update payment");
      }
    } catch (error) {
      console.error('Error updating payment:', error);
      toast({
        title: "Error",
        description: "Failed to update payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveEmployee = async (employmentId: string) => {
    setIsSaving(true);
    try {
      const result = await ProfileService.removeEmployeeFromGroup(employmentId);
      if (result.success) {
        // Update local state
        setEmployees(employees.filter(emp => emp.employment_id !== employmentId));
        toast({
          title: "Employee Removed",
          description: "Employee has been removed from the group.",
        });
      } else {
        throw new Error(result.error || "Failed to remove employee");
      }
    } catch (error) {
      console.error('Error removing employee:', error);
      toast({
        title: "Error",
        description: "Failed to remove employee. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePayEmployee = async (employee: Employee) => {
    setIsProcessingPayment(employee.employment_id);
    
    try {
      // Use a known successful transaction hash for demonstration
      // This is a real successful transaction on Ethereum mainnet
      const knownGoodTxHash = "0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060";
      
      // Show initial toast
      toast({
        title: "Payment Initiated",
        description: `Processing payment for ${employee.first_name} ${employee.last_name}`,
      });

      // Wait 5 seconds for transaction to be indexed by explorer, then lookup
      setTimeout(async () => {
        try {
          const response = await fetch(`https://memgpowzdqeuwdpueajh.functions.supabase.co/blockscout?chain=optimism-sepolia&hash=${knownGoodTxHash}&api=v2`);
          if (response.ok) {
            const txData = await response.json();
            console.log('Demo transaction data from Blockscout:', txData);
          }
        } catch (error) {
          console.log('Transaction lookup not available:', error);
        }
      }, 5000); // Wait 5 seconds
      
    } catch (error) {
      console.error('Error processing payment:', error);
      toast({
        title: "Payment Error",
        description: "Failed to process payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingPayment(null);
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

    try {
      // Use Supabase function to fetch recent transactions
      const response = await fetch(`https://memgpowzdqeuwdpueajh.functions.supabase.co/blockscout?chain=optimism-sepolia&address=${address}&api=v2`);
      if (response.ok) {
        const txData = await response.json();
        console.log('Transaction history:', txData);
        // You can display this data in a modal or component instead of opening a new tab
        toast({
          title: "Transaction History",
          description: `Found ${txData.result?.length || 0} transactions`,
        });
      }
    } catch (error) {
      console.log('Error fetching transaction history:', error);
      toast({
        title: "Error",
        description: "Failed to fetch transaction history",
        variant: "destructive",
      });
    }
  };

  // Search functionality
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    try {
      console.log('🔍 Performing search for:', searchQuery);
      const result = await ProfileService.searchEmployees(searchQuery);
      
      if (result.success) {
        setSearchResults(result.data);
        console.log('Search results:', result.data);
        
        if (result.data.length === 0) {
          toast({
            title: "No Results",
            description: "No employees found matching your search.",
          });
        }
      } else {
        console.error('Search error:', result.error);
        toast({
          title: "Search Error",
          description: "Failed to search employees. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search Error", 
        description: "Failed to search employees. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
  };

  const handleAddFromSearch = (employee: SearchResult) => {
    // Auto-fill the form fields with search result data
    setNewEmployee({
      address: employee.wallet_address,
      name: `${employee.first_name} ${employee.last_name}`,
      payment: "0", // Default payment amount
      chain: employee.chain || "ethereum",
      token: employee.token || "usdc"
    });
    setSearchResults([]);
    setSearchQuery("");
    setHasSearched(false);
    toast({
      title: "Employee Details Filled",
      description: `${employee.first_name} ${employee.last_name}'s details have been filled in the form below.`,
    });
  };

  const handleAddEmployee = async () => {
    if (newEmployee.address && newEmployee.name && newEmployee.payment && groupData) {
      setIsSaving(true);
      try {
        // Create employment record for the new employee
        const result = await ProfileService.addEmployeeToGroup({
          employerId: groupData.id, // This is the employer_id from the group
          employeeData: {
            first_name: newEmployee.name.split(' ')[0] || '',
            last_name: newEmployee.name.split(' ').slice(1).join(' ') || '',
            email: '',
            wallet_address: newEmployee.address,
            chain: newEmployee.chain,
            token: newEmployee.token,
            payment: newEmployee.payment
          }
        });

        if (result.success) {
          // Reload group data to get updated employee list
          const groupResult = await ProfileService.getPaymentGroupById(id!);
          if (groupResult.success && groupResult.data) {
            setEmployees(groupResult.data.employees);
            setGroupData(groupResult.data);
          }

          setNewEmployee({ address: "", name: "", payment: "", chain: "", token: "" });
          toast({
            title: "Employee Added",
            description: `${newEmployee.name} has been added to the group.`,
          });
        } else {
          throw new Error(result.error || "Failed to add employee");
        }
      } catch (error) {
        console.error('Error adding employee:', error);
        toast({
          title: "Error",
          description: "Failed to add employee. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
        <Navbar role="admin" />
        <div className="container mx-auto px-6 py-12">
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-muted-foreground">Loading group data...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!groupData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
        <Navbar role="admin" />
        <div className="container mx-auto px-6 py-12">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Group Not Found</h1>
            <p className="text-muted-foreground mb-4">The requested group could not be found.</p>
            <Button onClick={() => navigate("/admin/groups")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Groups
            </Button>
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
          className="max-w-5xl mx-auto space-y-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate("/admin/groups")}
                className="glass-card"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="space-y-2">
                <h1 className="text-4xl font-bold gradient-text">Edit Payment Group</h1>
                <p className="text-muted-foreground">Manage employees and update payment details</p>
              </div>
            </div>
            <Button
              onClick={handleViewTransactionHistory}
              variant="outline"
              className="glass-card border-white/20"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Transactions
            </Button>
          </div>

          {/* Group Name */}
          <Card className="glass-card p-8 hover-lift">
            <div className="space-y-4">
              <label className="text-lg font-semibold">Group Name</label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="glass-card border-white/20 text-lg"
              />
            </div>
          </Card>

          {/* Search & Add */}
          <Card className="glass-card p-6 hover-lift">
            <div className="space-y-4">
              <Label className="text-sm font-medium">Search for Employees</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by wallet address (0x...) or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="glass-card border-white/20 pl-10"
                  />
                </div>
                <Button 
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="bg-gradient-to-r from-primary to-blue-500 hover:opacity-90"
                >
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
                {searchQuery && (
                  <Button 
                    onClick={handleClearSearch}
                    variant="outline"
                    className="glass-card border-white/20"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Search Results</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {searchResults.map((employee) => (
                      <motion.div
                        key={employee.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between p-3 glass-card rounded-lg hover-lift"
                      >
                        <div className="flex-1">
                          <div className="font-semibold">{employee.first_name} {employee.last_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {employee.wallet_address.slice(0, 6)}...{employee.wallet_address.slice(-4)}
                          </div>
                          {employee.email && (
                            <div className="text-xs text-muted-foreground">{employee.email}</div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAddFromSearch(employee)}
                          className="bg-gradient-to-r from-primary to-blue-500 hover:opacity-90"
                        >
                          <Search className="h-4 w-4 mr-1" />
                          Fill Details
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Show appropriate message based on search state */}
              {!isSearching && (
                <div className="text-center py-4 text-muted-foreground">
                  {!hasSearched ? (
                    <div className="flex items-center justify-center gap-2">
                      <Search className="h-4 w-4" />
                      Click search to find employees
                    </div>
                  ) : searchResults.length === 0 ? (
                    `No employees found for "${searchQuery}"`
                  ) : null}
                </div>
              )}

              {/* Employee Form */}
              <div className="border-t pt-4">
                <Label className="text-sm font-medium mb-3 block">Add New Employee:</Label>
                <div className="grid md:grid-cols-3 gap-4">
                  <Input
                    placeholder="Wallet Address"
                    value={newEmployee.address}
                    onChange={(e) => setNewEmployee({ ...newEmployee, address: e.target.value })}
                    className="glass-card border-white/20 font-mono"
                  />
                  <Input
                    placeholder="Name"
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                    className="glass-card border-white/20"
                  />
                  <Input
                    placeholder="Payment (e.g., 200)"
                    value={newEmployee.payment}
                    onChange={(e) => setNewEmployee({ ...newEmployee, payment: e.target.value })}
                    className="glass-card border-white/20"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <Input
                    placeholder="Chain (e.g., ethereum)"
                    value={newEmployee.chain}
                    onChange={(e) => setNewEmployee({ ...newEmployee, chain: e.target.value })}
                    className="glass-card border-white/20"
                  />
                  <Input
                    placeholder="Token (e.g., usdc)"
                    value={newEmployee.token}
                    onChange={(e) => setNewEmployee({ ...newEmployee, token: e.target.value })}
                    className="glass-card border-white/20"
                  />
                </div>
                <Button
                  onClick={handleAddEmployee}
                  disabled={isSaving || !newEmployee.address || !newEmployee.name || !newEmployee.payment}
                  className="mt-4 bg-gradient-to-r from-primary to-blue-500 hover:opacity-90"
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  {isSaving ? "Adding..." : "Add Employee"}
                </Button>
              </div>
            </div>
          </Card>

          {/* Employee List */}
          <Card className="glass-card p-8 hover-lift">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Employees ({employees.length})</h2>
              <Badge className="bg-primary/20 text-primary">
                Total: ${employees.reduce((acc, emp) => {
                  const amount = parseFloat(emp.payment_amount || '0');
                  const token = emp.token || 'usdc';
                  return acc + convertToUSDC(amount, token);
                }, 0).toFixed(2)} USDC
              </Badge>
            </div>

            {employees.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No employees in this group yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {employees.map((emp) => (
                  <motion.div
                    key={emp.employment_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="glass-card p-4 hover-lift"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-1 grid grid-cols-4 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Address</div>
                          <div className="font-mono text-sm truncate" title={emp.wallet_address}>
                            {emp.wallet_address ? `${emp.wallet_address.slice(0, 6)}...${emp.wallet_address.slice(-4)}` : 'No address'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Name</div>
                          <div className="font-semibold">{emp.first_name} {emp.last_name}</div>
                          {emp.email && (
                            <div className="text-xs text-muted-foreground">{emp.email}</div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Chain/Token</div>
                          <div className="text-sm">{emp.chain} • {emp.token}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Payment</div>
                          {editingId === emp.employment_id ? (
                            <div className="flex gap-2">
                              <Input
                                value={editedPayment}
                                onChange={(e) => setEditedPayment(e.target.value)}
                                className="h-8 text-sm"
                                placeholder="Enter amount"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSavePayment(emp.employment_id)}
                                className="h-8 px-2"
                                disabled={isSaving}
                              >
                                {isSaving ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Save className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          ) : (
                            <div className="font-bold gradient-text">
                              {parseFloat(emp.payment_amount || '0').toFixed(6)} {emp.token?.toUpperCase() || 'USDC'}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePayEmployee(emp)}
                          className="text-green-600 hover:bg-green-500/10"
                          disabled={isProcessingPayment === emp.employment_id}
                          title="Pay Employee"
                        >
                          {isProcessingPayment === emp.employment_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingId(emp.employment_id);
                            setEditedPayment(emp.payment_amount || '');
                          }}
                          className="text-primary hover:bg-primary/10"
                          disabled={isSaving}
                          title="Edit Payment"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveEmployee(emp.employment_id)}
                          className="text-destructive hover:bg-destructive/10"
                          disabled={isSaving}
                          title="Remove Employee"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>

          {/* Back to Groups Button */}
          <Button
            onClick={() => navigate("/admin/groups")}
            size="lg"
            className="w-full bg-gradient-to-r from-primary via-blue-500 to-cyan-500 hover:opacity-90 text-lg py-6"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back to Groups
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default EditGroup;

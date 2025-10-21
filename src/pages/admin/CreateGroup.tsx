import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, X, Building2, Users, Loader2, Clock, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProfileService } from "@/lib/profileService";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  wallet_address: string;
  chain: string;
  token: string;
  secondary_chain?: string;
  secondary_token?: string;
  payment: string;
}

interface SearchResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  wallet_address: string;
  chain: string;
  token: string;
  secondary_chain?: string;
  secondary_token?: string;
}

interface Company {
  id: string;
  name: string;
  email: string;
}

const CreateGroup = () => {
  const { toast } = useToast();
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [newEmployee, setNewEmployee] = useState({ 
    address: "", 
    name: "", 
    payment: "",
    chain: "",
    token: "",
    secondary_chain: "",
    secondary_token: ""
  });
  
  // Payment schedule state
  const [paymentFrequency, setPaymentFrequency] = useState("");
  const [paymentStartDate, setPaymentStartDate] = useState("");
  const [paymentEndDate, setPaymentEndDate] = useState("");
  const [paymentDayOfWeek, setPaymentDayOfWeek] = useState("");

  // Load companies on component mount
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const result = await ProfileService.getAllCompanies();
        if (result.success) {
          setCompanies(result.data);
          console.log('Loaded companies:', result.data);
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
      }
    };

    loadCompanies();
  }, []);

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
      payment: "",
      chain: employee.chain,
      token: employee.token,
      secondary_chain: employee.secondary_chain || "",
      secondary_token: employee.secondary_token || ""
    });
    
    // Clear search results
    setSearchResults([]);
    setSearchQuery("");
    
    toast({
      title: "Employee Details Filled",
      description: `${employee.first_name} ${employee.last_name}'s details have been filled in the form.`,
    });
  };

  const handleAddEmployee = () => {
    if (newEmployee.address && newEmployee.name && newEmployee.payment) {
      setEmployees([...employees, {
        id: `temp-${Date.now()}`,
        first_name: newEmployee.name.split(' ')[0] || '',
        last_name: newEmployee.name.split(' ').slice(1).join(' ') || '',
        email: '',
        wallet_address: newEmployee.address,
        chain: newEmployee.chain,
        token: newEmployee.token,
        secondary_chain: newEmployee.secondary_chain,
        secondary_token: newEmployee.secondary_token,
        payment: newEmployee.payment
      }]);
      setNewEmployee({ address: "", name: "", payment: "", chain: "", token: "", secondary_chain: "", secondary_token: "" });
      toast({
        title: "Employee Added",
        description: `${newEmployee.name} has been added to the group.`,
      });
    }
  };

  const handleRemoveEmployee = (index: number) => {
    const updated = employees.filter((_, i) => i !== index);
    setEmployees(updated);
  };

  const handleCreateGroup = async () => {
    if (!selectedCompanyId) {
      toast({
        title: "Company Required",
        description: "Please select a company before creating the group.",
        variant: "destructive",
      });
      return;
    }
    
    if (!groupName) {
      toast({
        title: "Group Name Required",
        description: "Please enter a group name.",
        variant: "destructive",
      });
      return;
    }
    
    if (employees.length === 0) {
      toast({
        title: "Employees Required",
        description: "Please add at least one employee to the group.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const selectedCompany = companies.find(c => c.id === selectedCompanyId);
      
      const result = await ProfileService.createPaymentGroup({
        employerId: selectedCompanyId,
        groupName: groupName,
        employees: employees.map(emp => ({
          id: emp.id,
          first_name: emp.first_name,
          last_name: emp.last_name,
          email: emp.email,
          wallet_address: emp.wallet_address,
          chain: emp.chain,
          token: emp.token,
          secondary_chain: emp.secondary_chain,
          secondary_token: emp.secondary_token,
          payment: emp.payment || "0" // Use the payment from each employee
        })),
        payment_frequency: paymentFrequency,
        payment_start_date: paymentStartDate,
        payment_end_date: paymentEndDate,
        payment_day_of_week: paymentDayOfWeek
      });

      if (result.success) {
        toast({
          title: "Group Created Successfully",
          description: `${groupName} has been created for ${selectedCompany?.name} with ${employees.length} employees.`,
        });
        
        // Reset form
        setGroupName("");
        setEmployees([]);
        setNewEmployee({ address: "", name: "", payment: "", chain: "", token: "", secondary_chain: "", secondary_token: "" });
        setSelectedCompanyId("");
        setPaymentFrequency("");
        setPaymentStartDate("");
        setPaymentEndDate("");
        setPaymentDayOfWeek("");
      } else {
        throw new Error(result.error || "Failed to create group");
      }
    } catch (error) {
      console.error('Error creating group:', error);
      toast({
        title: "Error",
        description: "Failed to create the payment group. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
      <Navbar role="admin" />
      
      <div className="container mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto space-y-8"
        >
          <div className="space-y-2">
            <h1 className="text-4xl font-bold gradient-text flex items-center gap-3">
              <Building2 className="h-10 w-10" />
              Create Payment Group
            </h1>
            <p className="text-muted-foreground">Set up a new payment group and add employees</p>
          </div>

          {/* Company Selection */}
          <Card className="glass-card p-8 hover-lift">
            <div className="space-y-4">
              <Label htmlFor="company" className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Select Company
              </Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger className="glass-card border-white/20">
                  <SelectValue placeholder="Choose a company for this payment group" />
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
                  Selected: <span className="font-semibold text-foreground">
                    {companies.find(c => c.id === selectedCompanyId)?.name}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Group Name */}
          <Card className="glass-card p-8 hover-lift">
            <div className="space-y-4">
              <Label htmlFor="groupName" className="text-lg font-semibold">Group Name</Label>
              <Input
                id="groupName"
                placeholder="e.g., Engineering Team Q1"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="glass-card border-white/20 text-lg"
              />
            </div>
          </Card>

          {/* Payment Schedule */}
          <Card className="glass-card p-8 hover-lift">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Payment Schedule</h2>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Payment Frequency</Label>
                    <Select value={paymentFrequency} onValueChange={setPaymentFrequency}>
                      <SelectTrigger className="glass-card border-white/20">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Bi-weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Day of Week</Label>
                    <Select value={paymentDayOfWeek} onValueChange={setPaymentDayOfWeek}>
                      <SelectTrigger className="glass-card border-white/20">
                        <SelectValue placeholder="Select day" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monday">Monday</SelectItem>
                        <SelectItem value="tuesday">Tuesday</SelectItem>
                        <SelectItem value="wednesday">Wednesday</SelectItem>
                        <SelectItem value="thursday">Thursday</SelectItem>
                        <SelectItem value="friday">Friday</SelectItem>
                        <SelectItem value="saturday">Saturday</SelectItem>
                        <SelectItem value="sunday">Sunday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Start Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="date"
                        value={paymentStartDate}
                        onChange={(e) => setPaymentStartDate(e.target.value)}
                        className="glass-card border-white/20 pl-10"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">End Date (Optional)</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="date"
                        value={paymentEndDate}
                        onChange={(e) => setPaymentEndDate(e.target.value)}
                        className="glass-card border-white/20 pl-10"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-200/50">
                <p className="text-sm text-blue-800">
                  <strong>Auto Payment Schedule:</strong> Employees will be paid automatically based on the selected frequency and day of week. 
                  The start date determines when payments begin, and the end date (if set) determines when they stop.
                </p>
              </div>
            </div>
          </Card>

          {/* Add Employee */}
          <Card className="glass-card p-8 hover-lift">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Add Employees
            </h2>

            <div className="space-y-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or wallet address (0x... or .eth)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                  className="glass-card border-white/20 pl-10 pr-24"
                />
                <div className="absolute right-2 top-1 flex gap-1">
                  {searchQuery && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleClearSearch}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleSearch}
                    disabled={!searchQuery.trim() || isSearching}
                    className="h-8 px-3"
                  >
                    {isSearching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      Search Results ({searchResults.length}):
                    </Label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleClearSearch}
                      className="text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                  {searchResults.map((employee) => (
                    <motion.div
                      key={employee.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-card p-3 flex items-center justify-between hover-lift"
                    >
                      <div className="flex-1">
                        <div className="font-semibold">
                          {employee.first_name} {employee.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {employee.email} • {employee.wallet_address}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {employee.chain} • {employee.token}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAddFromSearch(employee)}
                        className="ml-2"
                      >
                        <Search className="h-4 w-4 mr-1" />
                        Fill Details
                      </Button>
                    </motion.div>
                  ))}
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
                <Label className="text-sm font-medium mb-3 block">Employee Details:</Label>
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
                    placeholder="Primary Chain (e.g., ethereum)"
                    value={newEmployee.chain}
                    onChange={(e) => setNewEmployee({ ...newEmployee, chain: e.target.value })}
                    className="glass-card border-white/20"
                  />
                  <Input
                    placeholder="Primary Token (e.g., usdc)"
                    value={newEmployee.token}
                    onChange={(e) => setNewEmployee({ ...newEmployee, token: e.target.value })}
                    className="glass-card border-white/20"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <Input
                    placeholder="Secondary Chain (optional)"
                    value={newEmployee.secondary_chain}
                    onChange={(e) => setNewEmployee({ ...newEmployee, secondary_chain: e.target.value })}
                    className="glass-card border-white/20"
                  />
                  <Input
                    placeholder="Secondary Token (optional)"
                    value={newEmployee.secondary_token}
                    onChange={(e) => setNewEmployee({ ...newEmployee, secondary_token: e.target.value })}
                    className="glass-card border-white/20"
                  />
                </div>

                <Button
                  onClick={handleAddEmployee}
                  className="w-full mt-4 bg-gradient-to-r from-primary to-blue-500 hover:opacity-90"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Employee
                </Button>
              </div>
            </div>
          </Card>

          {/* Employee List */}
          {employees.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="glass-card p-8 hover-lift">
                <h2 className="text-xl font-bold mb-6">
                  Added Employees ({employees.length})
                </h2>
                <div className="space-y-3">
                  {employees.map((emp, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="glass-card p-4 flex items-center justify-between hover-lift"
                    >
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Name</div>
                          <div className="font-semibold">{emp.first_name} {emp.last_name}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Address</div>
                          <div className="font-mono text-sm truncate" title={emp.wallet_address}>
                            {emp.wallet_address ? `${emp.wallet_address.slice(0, 6)}...${emp.wallet_address.slice(-4)}` : 'No address'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Primary Chain/Token</div>
                          <div className="text-sm">{emp.chain} • {emp.token}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Secondary Chain/Token</div>
                          <div className="text-sm">
                            {emp.secondary_chain && emp.secondary_token 
                              ? `${emp.secondary_chain} • ${emp.secondary_token}` 
                              : 'Not set'
                            }
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveEmployee(index)}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Create Button */}
          <Button
            onClick={handleCreateGroup}
            disabled={!selectedCompanyId || !groupName || employees.length === 0 || isLoading}
            size="lg"
            className="w-full bg-gradient-to-r from-primary via-blue-500 to-cyan-500 hover:opacity-90 text-lg py-6"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Creating Group...
              </>
            ) : (
              "Create Payment Group"
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default CreateGroup;

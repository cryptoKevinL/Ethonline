import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Wallet, User, DollarSign, Loader2, QrCode, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProfileService } from "@/lib/profileService";
import { useAccount } from "wagmi";
import QRCode from "qrcode";

const Profile = () => {
  const { toast } = useToast();
  const { address, isConnected } = useAccount();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    walletAddress: "",
    chain: "",
    token: "",
  });
  const [isSaved, setIsSaved] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [showQRCode, setShowQRCode] = useState(false);

  // Generate QR code for payment link
  const generateQRCode = async (walletAddress: string) => {
    if (!walletAddress) return;
    
    try {
      const paymentUrl = `${window.location.origin}/send-crypto/${walletAddress}`;
      const qrDataUrl = await QRCode.toDataURL(paymentUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeDataUrl(qrDataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  // Load existing profile data on component mount
  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      console.log('=== PROFILE LOAD DEBUG ===');
      console.log('Web3 connection status:', { isConnected, address });
      console.log('Current profileData state:', profileData);
      
      // Use the connected wallet address from Web3
      const walletAddress = address || "";
      console.log('Will search by wallet_address:', walletAddress);
      console.log('Will search by email:', profileData.email);
      
      // Try to load existing profile data using connected wallet
      const result = await ProfileService.loadEmployeeProfile({
        wallet_address: walletAddress, // Use connected wallet address
        email: profileData.email // Try with current email if any
      });
      
      console.log('ProfileService.loadEmployeeProfile result:', result);
      
      if (result.success && 'data' in result && result.data) {
        const { employee, wallet, employeeId } = result.data;
        console.log('Found employee data:', employee);
        console.log('Found wallet data:', wallet);
        console.log('Employee ID:', employeeId);
        
        if (employee) {
          const newProfileData = {
            first_name: employee.first_name || "",
            last_name: employee.last_name || "",
            email: employee.email || "",
            walletAddress: wallet?.account_address || walletAddress, // Use connected wallet if no stored wallet
            chain: wallet?.chain || "",
            token: wallet?.token || "",
          };
          
          console.log('Setting profile data to:', newProfileData);
          setProfileData(newProfileData);
          setIsSaved(true);
          
          // Generate QR code for the wallet address
          if (newProfileData.walletAddress) {
            await generateQRCode(newProfileData.walletAddress);
          }
          
          console.log('✅ Loaded existing profile data');
        } else {
          console.log('❌ No employee data found in result');
        }
      } else {
        console.log('❌ No existing profile found - starting with empty form');
        console.log('Error details:', 'error' in result ? result.error : 'Unknown error');
        
        // If no existing profile but wallet is connected, pre-fill wallet address
        if (walletAddress) {
          setProfileData(prev => ({
            ...prev,
            walletAddress: walletAddress
          }));
          console.log('✅ Pre-filled wallet address from Web3 connection');
        }
      }
      setIsLoading(false);
      console.log('=== END PROFILE LOAD DEBUG ===');
    };

    loadProfile();
  }, [address, isConnected]); // Re-run when wallet connection changes


  const handleSave = async () => {
    setIsLoading(true);
    console.log('Saving profile data:', profileData);
    
    try {
      const result = await ProfileService.saveEmployeeProfile({
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        email: profileData.email,
        wallet_address: profileData.walletAddress,
        preferred_chain: profileData.chain,
        preferred_token: profileData.token,
      });

      console.log('Save result:', result);

      if (result.success) {
        setIsSaved(true);
        setIsEditing(false);
        toast({
          title: "Profile Updated",
          description: "Your payment preferences have been saved successfully.",
        });
      } else {
        throw new Error(result.error || "Failed to save profile");
      }
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Error",
        description: "Failed to save your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
      <Navbar role="employee" />
      
      <div className="container mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto space-y-8"
        >
          <div className="space-y-2">
            <h1 className="text-4xl font-bold gradient-text">Payment Profile</h1>
            <p className="text-muted-foreground">Your payment preferences and information</p>
            
          </div>

          {/* Profile Summary Card - Shows when saved */}
          {isSaved && !isEditing && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card 
                className="glass-card p-8 hover-lift cursor-pointer"
                onClick={() => setIsEditing(true)}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3 flex-1">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Name</p>
                        <p className="text-lg font-semibold">{`${profileData.first_name} ${profileData.last_name}`.trim() || "Not set"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Wallet Address</p>
                        <p className="text-sm font-mono">{profileData.walletAddress || "Not set"}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Chain</p>
                          <p className="font-medium capitalize">{profileData.chain || "Not set"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Token</p>
                          <p className="font-medium uppercase">{profileData.token || "Not set"}</p>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground pt-2 border-t">
                    Click anywhere to edit your payment details
                  </p>
                </div>
              </Card>
            </motion.div>
          )}

          {/* QR Code Section */}
          {isSaved && profileData.walletAddress && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <Card className="glass-card p-8 hover-lift">
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <QrCode className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Payment QR Code</h3>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    Share this QR code to receive payments directly to your wallet
                  </p>
                  
                  {qrCodeDataUrl && (
                    <div className="flex justify-center">
                      <div className="p-4 bg-white rounded-lg border-2 border-gray-200 inline-block">
                        <img 
                          src={qrCodeDataUrl} 
                          alt="Payment QR Code" 
                          className="w-48 h-48"
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Payment Link:</p>
                    <div className="flex items-center gap-2 justify-center">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {window.location.origin}/send-crypto/{profileData.walletAddress}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/send-crypto/${profileData.walletAddress}`);
                          toast({
                            title: "Copied!",
                            description: "Payment link copied to clipboard",
                          });
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/send-crypto/${profileData.walletAddress}`, '_blank')}
                    className="mt-4"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Test Payment Page
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Edit Form - Shows when editing or not saved yet */}
          {(!isSaved || isEditing) && (

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <Card className="glass-card p-8 hover-lift">
              <div className="space-y-6">
                <motion.div variants={itemVariants} className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name" className="flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      First Name
                    </Label>
                    <Input
                      id="first_name"
                      placeholder="Enter your first name"
                      value={profileData.first_name}
                      onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
                      className="glass-card border-white/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name" className="flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      Last Name
                    </Label>
                    <Input
                      id="last_name"
                      placeholder="Enter your last name"
                      value={profileData.last_name}
                      onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                      className="glass-card border-white/20"
                    />
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className="glass-card border-white/20"
                  />
                </motion.div>

                <motion.div variants={itemVariants} className="space-y-2">
                  <Label htmlFor="wallet" className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    Wallet Address
                  </Label>
                  <Input
                    id="wallet"
                    placeholder="0x..."
                    value={profileData.walletAddress}
                    onChange={(e) => setProfileData({ ...profileData, walletAddress: e.target.value })}
                    className="glass-card border-white/20 font-mono"
                  />
                </motion.div>

                <motion.div variants={itemVariants} className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      Preferred Chain
                    </Label>
                    <Select value={profileData.chain} onValueChange={(value) => setProfileData({ ...profileData, chain: value })}>
                      <SelectTrigger className="glass-card border-white/20">
                        <SelectValue placeholder="Select chain" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ethereum">Sepolia</SelectItem>
                        <SelectItem value="polygon">Amoy</SelectItem>
                        <SelectItem value="arbitrum">Arbitrum Sepolia</SelectItem>
                        <SelectItem value="optimism">Op Sepolia</SelectItem>
                        <SelectItem value="base">Base Sepolia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      Preferred Token
                    </Label>
                    <Select value={profileData.token} onValueChange={(value) => setProfileData({ ...profileData, token: value })}>
                      <SelectTrigger className="glass-card border-white/20">
                        <SelectValue placeholder="Select token" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="usdc">USDC</SelectItem>
                        <SelectItem value="usdt">USDT</SelectItem>
                        <SelectItem value="eth">ETH</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="flex gap-3">
                  <Button
                    onClick={handleSave}
                    disabled={isLoading}
                    size="lg"
                    className="flex-1 bg-gradient-to-r from-primary to-blue-500 hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {isLoading ? "Saving..." : "Save Profile"}
                  </Button>
                  {isEditing && (
                    <Button
                      onClick={() => setIsEditing(false)}
                      variant="outline"
                      size="lg"
                    >
                      Cancel
                    </Button>
                  )}
                </motion.div>
              </div>
            </Card>
          </motion.div>
          )}

          {/* Info Card */}
          {(!isSaved || isEditing) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="glass-card p-6 bg-gradient-to-r from-primary/10 to-blue-500/10">
                <div className="flex gap-4">
                  <div className="text-primary">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Payment Information</h3>
                    <p className="text-sm text-muted-foreground">
                      Your payment details are encrypted and securely stored. You can update them anytime.
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
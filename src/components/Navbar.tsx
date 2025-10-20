import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Wallet, LogOut, AlertCircle } from "lucide-react";
import { ConnectKitButton } from "connectkit";
import { useAccount, useSwitchChain } from 'wagmi';
import { useNexus } from '@/providers/NexusProvider';
import { useEffect } from 'react';
import { UnifiedBalanceButton } from '@/components/UnifiedBalanceButton';

interface NavbarProps {
  role: "employee" | "admin";
}

export const Navbar = ({ role }: NavbarProps) => {
  const location = useLocation();
  const { isConnected, connector, address, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { handleInit, isInitialized, isLoading, error } = useNexus();

  const employeeLinks = [
    { path: "/employee/home", label: "Home" },
    { path: "/employee/employment", label: "Current Employment" },
    { path: "/employee/profile", label: "Profile" },
  ];

  const adminLinks = [
    { path: "/admin/home", label: "Home" },
    { path: "/admin/create-group", label: "Create Group" },
    { path: "/admin/groups", label: "All Groups" },
    { path: "/admin/profile", label: "Profile" },
  ];

  const links = role === "employee" ? employeeLinks : adminLinks;

  const testnetChainIds = [11155111, 84532, 421614, 11155420, 80002];
  const isOnTestnet = chain && testnetChainIds.includes(chain.id);

  // Auto-initialize Nexus when wallet connects to testnet
  useEffect(() => {
    if (isConnected && connector && address && isOnTestnet && !isInitialized && !isLoading) {
      console.log('Auto-initializing Nexus SDK on TESTNET...');
      handleInit();
    }
  }, [isConnected, connector, address, isOnTestnet, isInitialized, isLoading, handleInit]);

  const switchToSepolia = () => {
    switchChain({ chainId: 11155111 });
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="glass-card sticky top-0 z-50 border-b"
    >
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="flex items-center"
              >
                <img 
                  src="/logo.png" 
                  alt="PayStream" 
                  className="h-8 w-auto"
                />
              </motion.div>
            </Link>
            <div className="px-3 py-1 rounded-full glass-card text-xs font-medium text-primary">
              {role === "employee" ? "Employee" : "Admin"}
            </div>
          </div>

          <div className="flex items-center gap-8">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="relative group"
              >
                <span
                  className={`text-sm font-medium transition-colors ${
                    location.pathname === link.path
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {link.label}
                </span>
                {location.pathname === link.path && (
                  <motion.div
                    layoutId="navbar-indicator"
                    className="absolute -bottom-[1.15rem] left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-blue-500 to-cyan-500"
                  />
                )}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* Network Warning */}
            {isConnected && !isOnTestnet && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-100 text-yellow-800 border border-yellow-200">
                <AlertCircle className="h-4 w-4" />
                <div className="flex flex-col">
                  <span className="text-xs font-medium">Switch to Testnet</span>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="h-auto p-0 text-xs text-yellow-800"
                    onClick={switchToSepolia}
                  >
                    Switch to Sepolia
                  </Button>
                </div>
              </div>
            )}

            {/* Unified Balance Button */}
            {isConnected && isOnTestnet && <UnifiedBalanceButton />}

            {/* ConnectKit Button */}
            <ConnectKitButton.Custom>
              {({ isConnected, isConnecting, show, address, ensName }) => {
                return (
                  <Button 
                    onClick={show}
                    className="bg-gradient-to-r from-primary to-blue-500 hover:opacity-90 transition-opacity"
                    disabled={isConnecting}
                  >
                    <Wallet className="mr-2 h-4 w-4" />
                    {isConnected ? (
                      <span className="font-mono">
                        {ensName || `${address?.slice(0, 6)}...${address?.slice(-4)}`}
                      </span>
                    ) : (
                      "Connect Wallet"
                    )}
                  </Button>
                );
              }}
            </ConnectKitButton.Custom>

            <Button variant="ghost" size="icon" title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </motion.nav>
  );
};
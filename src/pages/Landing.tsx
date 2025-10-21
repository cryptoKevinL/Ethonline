import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Shield, Wallet } from "lucide-react";
import { ConnectKitButton } from "connectkit";
import { useAccount } from "wagmi";
import { useEffect } from "react";

const Landing = () => {
  const navigate = useNavigate();
  const { isConnected } = useAccount();

  const handleEmployeeClick = () => {
    if (isConnected) {
      navigate("/employee/home");
    }
  };

  const handleAdminClick = () => {
    if (isConnected) {
      navigate("/admin/home");
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute top-20 right-20 w-96 h-96 bg-gradient-to-r from-primary/20 to-cyan-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            rotate: [90, 0, 90],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute bottom-20 left-20 w-96 h-96 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-3xl"
        />
      </div>

      {/* Wallet Connection in Top Right */}
      <div className="absolute top-6 right-6 z-20">
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
      </div>

      <div className="relative z-10 container mx-auto px-6 py-20">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-4xl mx-auto text-center space-y-12"
        >
          {/* Hero Section */}
          <motion.div variants={itemVariants} className="space-y-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.8 }}
              className="inline-block"
            >
              <Wallet className="h-20 w-20 text-primary mx-auto animate-float" />
            </motion.div>
            <div className="flex justify-center">
              <img 
                src="/logoMainPage.png" 
                alt="PayStream" 
                className="h-20 w-auto"
              />
            </div>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              The future of decentralized payroll management. Secure, transparent, and efficient.
            </p>
          </motion.div>

          {/* Role Selection Cards */}
          <motion.div
            variants={itemVariants}
            className="grid md:grid-cols-2 gap-8 mt-16"
          >
            {/* Employee Card */}
            <ConnectKitButton.Custom>
              {({ isConnected, isConnecting, show, address, ensName }) => (
                <motion.div whileHover={{ scale: 1.03 }} className="h-full">
                  <Card 
                    className="glass-card p-8 h-full hover-lift cursor-pointer group" 
                    onClick={isConnected ? handleEmployeeClick : show}
                  >
                    <div className="space-y-6">
                      <motion.div
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.5 }}
                        className="inline-block"
                      >
                        <Users className="h-16 w-16 text-primary" />
                      </motion.div>
                      <div>
                        <h2 className="text-3xl font-bold mb-3 text-gray-900">Employee</h2>
                        <p className="text-gray-600 mb-6">
                          Manage your profile, view employment status, and track your payments
                        </p>
                      </div>
                      <Button
                        onClick={isConnected ? handleEmployeeClick : show}
                        disabled={isConnecting}
                        className="w-full px-6 py-3 bg-gradient-to-r from-primary to-blue-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                      >
                        <Wallet className="h-4 w-4" />
                        {isConnected ? "Enter Dashboard" : "Connect Wallet"}
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )}
            </ConnectKitButton.Custom>

            {/* Admin Card */}
            <ConnectKitButton.Custom>
              {({ isConnected, isConnecting, show, address, ensName }) => (
                <motion.div whileHover={{ scale: 1.03 }} className="h-full">
                  <Card 
                    className="glass-card p-8 h-full hover-lift cursor-pointer group" 
                    onClick={isConnected ? handleAdminClick : show}
                  >
                    <div className="space-y-6">
                      <motion.div
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.5 }}
                        className="inline-block"
                      >
                        <Shield className="h-16 w-16 text-primary" />
                      </motion.div>
                      <div>
                        <h2 className="text-3xl font-bold mb-3 text-gray-900">Admin</h2>
                        <p className="text-gray-600 mb-6">
                          Create groups, manage employees, and process payments seamlessly
                        </p>
                      </div>
                      <Button
                        onClick={isConnected ? handleAdminClick : show}
                        disabled={isConnecting}
                        className="w-full px-6 py-3 bg-gradient-to-r from-primary to-cyan-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                      >
                        <Wallet className="h-4 w-4" />
                        {isConnected ? "Enter Dashboard" : "Connect Wallet"}
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )}
            </ConnectKitButton.Custom>
          </motion.div>

          {/* Features */}
          <motion.div variants={itemVariants} className="grid md:grid-cols-3 gap-6 mt-16">
            {[
              { icon: Shield, title: "Secure", desc: "Web3 wallet authentication" },
              { icon: Wallet, title: "Flexible", desc: "Multi-chain & token support" },
              { icon: Users, title: "Scalable", desc: "Manage unlimited employees" },
            ].map((feature, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -5 }}
                className="glass-card p-6 text-center"
              >
                <feature.icon className="h-8 w-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold mb-2 text-gray-900">{feature.title}</h3>
                <p className="text-sm text-gray-600">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Landing;
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
// Removed Blockscout SDK imports since we're using Supabase function instead
import Web3Provider from "@/providers/Web3Provider";

import Landing from "./pages/Landing";
import EmployeeHome from "./pages/employee/Home";
import EmployeeProfile from "./pages/employee/Profile";
import Employment from "./pages/employee/Employment";
import AdminHome from "./pages/admin/Home";
import AdminProfile from "./pages/admin/Profile";
import CreateGroup from "./pages/admin/CreateGroup";
import Groups from "./pages/admin/Groups";
import EditGroup from "./pages/admin/EditGroup";
import SendCrypto from "./pages/SendCrypto";
import SendCryptoToUser from "./pages/SendCryptoToUser";
import NotFound from "./pages/NotFound";
import { NotificationProvider, TransactionPopupProvider } from "@blockscout/app-sdk";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Web3Provider>
       <NotificationProvider>
      <TransactionPopupProvider>
      <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Landing />} />
                
                {/* Employee Routes - Protected */}
                <Route 
                  path="/employee/home" 
                  element={
                  
                      <EmployeeHome />
                 
                  } 
                />
                <Route 
                  path="/employee/employment" 
                  element={
                   
                      <Employment />
                    
                  } 
                />
                <Route 
                  path="/employee/profile" 
                  element={
                   
                      <EmployeeProfile />
                    
                  } 
                />
                
                {/* Admin Routes - Protected */}
                <Route 
                  path="/admin/home" 
                  element={
                   
                      <AdminHome />
                   
                  } 
                />
                <Route 
                  path="/admin/create-group" 
                  element={
                    
                      <CreateGroup />
                   
                  } 
                />
                <Route 
                  path="/admin/groups" 
                  element={
                    
                      <Groups />
                    
                  } 
                />
                <Route 
                  path="/admin/edit-group/:id" 
                  element={
                   
                      <EditGroup />
                   
                  } 
                />
                <Route 
                  path="/admin/profile" 
                  element={
                 
                      <AdminProfile />
                    
                  } 
                />
                
                {/* Send Crypto Route */}
                <Route 
                  path="/send-crypto" 
                  element={
                    <SendCrypto />
                  } 
                />
                
                {/* Send Crypto to User Route */}
                <Route 
                  path="/send-crypto/:walletAddress" 
                  element={
                    <SendCryptoToUser />
                  } 
                />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
          </TransactionPopupProvider>
      </NotificationProvider>
    </Web3Provider>
  </QueryClientProvider>
);

export default App;
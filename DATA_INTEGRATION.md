# Data Integration Guide

This guide explains how to replace mock data with real backend data in the PayStream application.

## Overview

Currently, the application uses mock/static data for demonstration purposes. To connect to a real backend (Web3 wallet integration, smart contracts, database), follow the integration steps below for each component.

---

## Employee Pages

### 1. Employee Home (`src/pages/employee/Home.tsx`)

**Current Mock Data:**
```javascript
const stats = [
  { label: "Total Earned", value: "$12,450", trend: "+12.5%" },
  { label: "Active Contracts", value: "3", trend: "+1 this month" },
  { label: "Next Payment", value: "5 days", trend: "$850 pending" },
];
```

**Integration Steps:**
1. Replace with API calls or smart contract queries to fetch:
   - Total earned amount from payment history
   - Number of active employment contracts
   - Next payment date and amount from smart contract events
2. Use Web3 libraries (ethers.js, wagmi, viem) to query blockchain data
3. Example integration:
```typescript
const { data: totalEarned } = useContractRead({
  address: PAYMENT_CONTRACT_ADDRESS,
  abi: PaymentContractABI,
  functionName: 'getTotalEarned',
  args: [employeeAddress],
});
```

---

### 2. Employee Profile (`src/pages/employee/Profile.tsx`)

**Current Mock Data:**
```javascript
const [profileData, setProfileData] = useState({
  name: "",
  walletAddress: "",
  chain: "",
  token: "",
});
```

**Integration Steps:**
1. Load existing profile data from database/IPFS on component mount
2. Connect wallet using wagmi/RainbowKit or similar:
```typescript
import { useAccount } from 'wagmi';

const { address, isConnected } = useAccount();
// Use address for walletAddress field
```
3. Save profile data to:
   - Database (Supabase, PostgreSQL)
   - IPFS for decentralized storage
   - Smart contract storage (gas costs apply)
4. Example save function:
```typescript
const handleSave = async () => {
  await fetch('/api/employee/profile', {
    method: 'POST',
    body: JSON.stringify(profileData),
  });
};
```

---

### 3. Employment Page (`src/pages/employee/Employment.tsx`)

**Current Mock Data:**
```javascript
const employments = [
  { company: "Tech Corp", role: "Senior Developer", salary: "$850/month" },
  // ...
];
```

**Integration Steps:**
1. Query smart contract for active employment records:
```typescript
const { data: employments } = useContractRead({
  address: PAYMENT_CONTRACT_ADDRESS,
  abi: PaymentContractABI,
  functionName: 'getEmployeeContracts',
  args: [employeeAddress],
});
```
2. Listen to contract events for real-time updates:
```typescript
useContractEvent({
  address: PAYMENT_CONTRACT_ADDRESS,
  abi: PaymentContractABI,
  eventName: 'PaymentProcessed',
  listener: (logs) => {
    // Update payment history
  },
});
```

---

## Admin Pages

### 4. Admin Home (`src/pages/admin/Home.tsx`)

**Current Mock Data:**
```javascript
const stats = [
  { label: "Total Employees", value: "24" },
  { label: "Active Groups", value: "5" },
  { label: "Monthly Payout", value: "$45,600" },
];
```

**Integration Steps:**
1. Query database/smart contract for aggregate statistics
2. Example query:
```typescript
// Get total employees across all groups
const totalEmployees = await contract.getTotalEmployees();

// Get monthly payout from all active groups
const groups = await contract.getAdminGroups(adminAddress);
const totalPayout = groups.reduce((sum, group) => sum + group.monthlyPayout, 0);
```

---

### 5. Create Group (`src/pages/admin/CreateGroup.tsx`)

**Current Mock Data:**
```javascript
const [searchResults, setSearchResults] = useState([]);
```

**Integration Steps:**
1. Search employees by address/name from database:
```typescript
const searchEmployees = async (query: string) => {
  const results = await fetch(`/api/employees/search?q=${query}`);
  return results.json();
};
```
2. Create group by calling smart contract:
```typescript
const createGroup = async (groupData) => {
  const tx = await paymentContract.createGroup(
    groupData.name,
    groupData.employees.map(e => e.address),
    groupData.employees.map(e => ethers.utils.parseUnits(e.salary, 18)),
    groupData.token,
    groupData.chain
  );
  await tx.wait();
};
```

---

### 6. All Groups (`src/pages/admin/Groups.tsx`)

**Current Mock Data:**
```javascript
const groups = [
  { id: "1", name: "Engineering Team", employees: 12, monthlyPayout: "$24,000" },
];
```

**Integration Steps:**
1. Fetch groups from smart contract:
```typescript
const { data: groups } = useContractRead({
  address: PAYMENT_CONTRACT_ADDRESS,
  abi: PaymentContractABI,
  functionName: 'getAdminGroups',
  args: [adminAddress],
});
```
2. Process payment by calling smart contract function:
```typescript
const processPayment = async (groupId: string) => {
  const tx = await paymentContract.processGroupPayment(groupId);
  await tx.wait();
  toast({ title: "Payment processed successfully" });
};
```

---

### 7. Edit Group (`src/pages/admin/EditGroup.tsx`)

**Integration Steps:**
1. Load group data from contract:
```typescript
const { data: groupData } = useContractRead({
  address: PAYMENT_CONTRACT_ADDRESS,
  abi: PaymentContractABI,
  functionName: 'getGroup',
  args: [groupId],
});
```
2. Update group details:
```typescript
const updateEmployee = async (employeeAddress: string, newSalary: string) => {
  const tx = await paymentContract.updateEmployeeSalary(
    groupId,
    employeeAddress,
    ethers.utils.parseUnits(newSalary, 18)
  );
  await tx.wait();
};
```

---

## Navbar Integration

### Wallet Connection (`src/components/Navbar.tsx`)

**Integration Steps:**
1. Install wallet connection library:
```bash
npm install wagmi viem @rainbow-me/rainbowkit
```

2. Wrap app with providers in `App.tsx`:
```typescript
import { WagmiConfig } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';

// Configure chains and providers
```

3. Update Navbar to use real wallet connection:
```typescript
import { useAccount, useConnect, useDisconnect } from 'wagmi';

const { address, isConnected } = useAccount();
const { connect, connectors } = useConnect();
const { disconnect } = useDisconnect();
```

---

## Recommended Tech Stack

### Web3 Integration
- **Wallet Connection**: RainbowKit, wagmi, or Web3Modal
- **Contract Interaction**: ethers.js v6 or viem
- **Chain Support**: Ethereum, Polygon, Arbitrum, Optimism, Base

### Backend Options
1. **Smart Contracts Only** (Fully decentralized)
   - Store all data on-chain
   - Use events for historical data
   - Higher gas costs

2. **Hybrid Approach** (Recommended)
   - Smart contracts for payments
   - Database for profile/metadata (Supabase, PostgreSQL)
   - IPFS for documents

3. **Backend API**
   - Use Supabase for authentication
   - Store off-chain data in PostgreSQL
   - Sync critical data to blockchain

### Payment Streaming
Consider integrating payment streaming protocols:
- **Superfluid**: Real-time salary streaming
- **Sablier**: Token vesting and streaming
- **LlamaPay**: Payroll streaming

---

## Environment Variables

Create a `.env` file with:
```
VITE_PAYMENT_CONTRACT_ADDRESS=0x...
VITE_CHAIN_ID=1
VITE_ALCHEMY_KEY=your_key
VITE_WALLETCONNECT_PROJECT_ID=your_id
```

---

## Security Considerations

1. **Never expose private keys** in frontend code
2. **Validate all inputs** before sending transactions
3. **Use ethers.utils.parseUnits()** for token amounts
4. **Implement proper error handling** for failed transactions
5. **Add transaction confirmation** before state updates
6. **Rate limit API calls** to prevent abuse

---

## Testing

Before deploying:
1. Test all contract interactions on testnets (Sepolia, Mumbai)
2. Verify transaction receipts
3. Test edge cases (insufficient balance, network errors)
4. Ensure proper loading states during transactions

---

## Next Steps

1. Deploy smart contracts to testnet
2. Set up Web3 wallet integration (RainbowKit recommended)
3. Replace mock data with contract calls, one component at a time
4. Add proper error handling and loading states
5. Test thoroughly on testnet before mainnet deployment

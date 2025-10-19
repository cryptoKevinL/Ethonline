// Chain mapping from database names to Nexus SDK chain IDs
export const CHAIN_MAPPING: { [key: string]: number } = {
  'optimism': 11155420,
  'ethereum': 11155111,
  'polygon': 80002,
  'arbitrum': 421614,
  'base': 84532,
  'monad': 1014,
  'optimism-sepolia': 11155420,
  'op-sepolia': 11155420,
  'sepolia': 11155111,
  'polygon-amoy': 80002,
  'arbitrum-sepolia': 421614,
  'base-sepolia': 84532,
  'monad-testnet': 1014
};

// Reverse mapping from chain ID to chain name for display
export const CHAIN_ID_TO_NAME: { [key: number]: string } = {
  11155420: 'Optimism Sepolia',
  11155111: 'Ethereum Sepolia', 
  80002: 'Polygon Amoy',
  421614: 'Arbitrum Sepolia',
  84532: 'Base Sepolia',
  1014: 'Monad Testnet'
};

// Token mapping to ensure correct token types
export const TOKEN_MAPPING: { [key: string]: 'USDC' | 'USDT' | 'ETH' } = {
  'usdc': 'USDC',
  'usdt': 'USDT', 
  'eth': 'ETH',
  'ethereum': 'ETH'
};

// Conversion rates to USDC
export const TOKEN_CONVERSION_RATES: { [key: string]: number } = {
  'usdc': 1,
  'usdt': 1,
  'eth': 4000,
  'ethereum': 4000,
};

// Token address to symbol mapping
export const TOKEN_ADDRESS_MAP: { [key: string]: { symbol: string; decimals: number } } = {
  '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238': { symbol: 'USDC', decimals: 6 },
  '0x5fd84259d66cd46123540766be93dfe6d43130d7': { symbol: 'USDC', decimals: 6 },
  '0x036cbd53842c5426634e7929541ec2318f3dcf7e': { symbol: 'USDC', decimals: 6 },
  '0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8': { symbol: 'USDC', decimals: 6 },
  '': { symbol: 'ETH', decimals: 18 },
  'null': { symbol: 'ETH', decimals: 18 },
  'undefined': { symbol: 'ETH', decimals: 18 },
  '0x0000000000000000000000000000000000000000': { symbol: 'ETH', decimals: 18 },
};

export const convertToUSDC = (amount: number, token: string): number => {
  const normalizedToken = token.toLowerCase();
  const rate = TOKEN_CONVERSION_RATES[normalizedToken] || 1;
  return amount * rate;
};

export const formatTotalPayment = (group: any): string => {
  if (group.totalPaymentUSDC) {
    return `${Math.round(group.totalPaymentUSDC).toLocaleString()} USDC`;
  }
  return group.totalPayment;
};

export const getChainId = (chainName: string): number => {
  const normalizedChain = chainName.toLowerCase().trim();
  return CHAIN_MAPPING[normalizedChain] || 11155420;
};

export const getTokenType = (tokenName: string): 'USDC' | 'USDT' | 'ETH' => {
  const normalizedToken = tokenName.toLowerCase().trim();
  return TOKEN_MAPPING[normalizedToken] || 'USDC';
};

export const getChainName = (chainId: number): string => {
  return CHAIN_ID_TO_NAME[chainId] || 'Optimism Sepolia';
};

export const validateEmployeeData = (employee: any) => {
  if (!employee.wallet_address || employee.wallet_address.trim() === '') {
    throw new Error(`Employee ${employee.first_name} ${employee.last_name} has no wallet address`);
  }
  
  if (!employee.payment_amount || parseFloat(employee.payment_amount) <= 0) {
    throw new Error(`Employee ${employee.first_name} ${employee.last_name} has invalid payment amount`);
  }
  
  if (!employee.wallet_address.startsWith('0x') || employee.wallet_address.length !== 42) {
    throw new Error(`Employee ${employee.first_name} ${employee.last_name} has invalid wallet address format`);
  }
};
export const CONTRACT_ADDRESSES = {
  SWAP: "0xa28F4779fbf73C1E6a2C6A7c191EaDdca0A9C9F7",
  USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  PYUSD: "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9",
} as const;

export const SWAP_ABI = [
  "function swapEthForUsdc() external payable",
  "function swapEthForPyusd() external payable",
  "function swapUsdcForEth(uint256 amount) external",
  "function swapPyusdForEth(uint256 amount) external",
  "function swapUsdcForPyusd(uint256 amount) external",
  "function swapPyusdForUsdc(uint256 amount) external",
  "function addEthLiquidity() external payable",
  "function addUsdcLiquidity(uint256 amount) external",
  "function addPyusdLiquidity(uint256 amount) external",
  "function removeEthLiquidity(uint256 amount) external",
  "function removeUsdcLiquidity(uint256 amount) external",
  "function removePyusdLiquidity(uint256 amount) external",
  "function getEthBalance() external view returns (uint256)",
  "function getUsdcBalance() external view returns (uint256)",
  "function getPyusdBalance() external view returns (uint256)",
  "function calculateEthToUsdc(uint256 ethAmount) external view returns (uint256)",
  "function calculateEthToPyusd(uint256 ethAmount) external view returns (uint256)",
  "function calculateUsdcToEth(uint256 usdcAmount) external view returns (uint256)",
  "function calculatePyusdToEth(uint256 pyusdAmount) external view returns (uint256)",
  "function calculateUsdcToPyusd(uint256 usdcAmount) external view returns (uint256)",
  "function calculatePyusdToUsdc(uint256 pyusdAmount) external view returns (uint256)",
  "function owner() external view returns (address)",
  "event Swapped(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut)",
] as const;

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
] as const;
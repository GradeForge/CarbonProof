/**
 * Blockchain adapter for CarbonProof — Ethereum Sepolia integration.
 *
 * This module is isolated from AI and deterministic audit logic. It handles:
 * - EIP-1193 wallet detection and connection
 * - Sepolia chain ID enforcement and network switching
 * - Read-only contract queries via JSON-RPC (no ethers dependency)
 * - Transaction signing through the user's connected wallet only
 * - Receipt waiting and status checking
 * - Typed results with transaction hashes and receipt details
 *
 * No private keys are stored, transmitted, or handled by this module.
 * All signing happens in the user's wallet (MetaMask).
 */

// --- Constants ---

export const SEPOLIA_CHAIN_ID = '0xaa36a7'; // 11155111 in hex
export const SEPOLIA_CHAIN_ID_DEC = 11155111;
export const SEPOLIA_NETWORK_PARAMS = {
  chainId: SEPOLIA_CHAIN_ID,
  chainName: 'Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
  blockExplorerUrls: ['https://sepolia.etherscan.io'],
};
export const DEFAULT_SEPOLIA_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';
export const SEPOLIA_EXPLORER_TX = 'https://sepolia.etherscan.io/tx';
export const SEPOLIA_EXPLORER_ADDR = 'https://sepolia.etherscan.io/address';

// --- Types ---

export type BlockchainError =
  | 'WALLET_NOT_FOUND'
  | 'WALLET_CONNECTION_REJECTED'
  | 'WRONG_CHAIN'
  | 'NETWORK_SWITCH_FAILED'
  | 'CONTRACT_NOT_CONFIGURED'
  | 'INVALID_CONTRACT_ADDRESS'
  | 'CONTRACT_UNAVAILABLE'
  | 'ALREADY_REGISTERED'
  | 'TRANSACTION_REJECTED'
  | 'TRANSACTION_FAILED'
  | 'RPC_ERROR'
  | 'TIMEOUT'
  | 'INSUFFICIENT_FUNDS'
  | 'EIP7702_DELEGATION_ACTIVE'
  | 'PREFLIGHT_CHECK_FAILED'
  | 'UNKNOWN';

export interface BlockchainErrorResult {
  error: BlockchainError;
  message: string;
}

export interface WalletState {
  available: boolean;
  connected: boolean;
  address: string | null;
  chainId: number | null;
  isSepolia: boolean;
}

export interface OnChainRegistration {
  registered: boolean;
  recordIdHash: string | null;
  registrar: string | null;
  registeredAt: number | null; // unix timestamp
}

export interface RegistrationReceipt {
  transactionHash: string;
  blockNumber: number;
  status: boolean; // true = success, false = reverted
  gasUsed: number;
  effectiveGasPrice: string;
}

export interface RegisterResult {
  receipt: RegistrationReceipt;
  recordIdHash: string;
}

export interface ContractConfig {
  configured: boolean;
  address: string | null;
  rpcUrl: string;
}

// --- EIP-1193 provider types ---

interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, handler: (args: unknown) => void) => void;
  removeListener?: (event: string, handler: (args: unknown) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

// --- Minimal keccak256 (needed for function selectors and record ID hashing) ---

// This is a compact keccak256 implementation for browser use.
// It is used only for computing function selectors and hashing record IDs —
// not for security-critical operations beyond what Ethereum itself requires.

// Keccak-f[1600] permutation — compact implementation
const RC: bigint[] = [];
const RC_HEX = [
  '0x0000000000000001','0x0000000000008082','0x800000000000808a','0x8000000080008000',
  '0x000000000000808b','0x0000000080000001','0x8000000080008081','0x8000000000008009',
  '0x000000000000008a','0x0000000000000088','0x0000000080008009','0x000000008000000a',
  '0x000000008000808b','0x800000000000008b','0x8000000000008089','0x8000000000008003',
  '0x8000000000008002','0x8000000000000080','0x000000000000800a','0x800000008000000a',
  '0x8000000080008081','0x8000000000008080','0x0000000080000001','0x8000000080008008',
];
RC_HEX.forEach(h => RC.push(BigInt(h)));

// Rotation offsets for each lane (x, y), indexed as RHO[x + y*5].
// These are the standard Keccak-f[1600] rho offsets.
const RHO_OFFSETS: number[] = [
  0,  1, 62, 28, 27,   // y=0: x=0..4
  36, 44,  6, 55, 20,   // y=1: x=0..4
   3, 10, 43, 25, 39,   // y=2: x=0..4
  41, 45, 15, 21,  8,   // y=3: x=0..4
  18,  2, 61, 56, 14,   // y=4: x=0..4
];

function keccakf(state: bigint[]): void {
  for (let round = 0; round < 24; round++) {
    // Theta
    const C: bigint[] = [];
    for (let x = 0; x < 5; x++) {
      C[x] = state[x] ^ state[x+5] ^ state[x+10] ^ state[x+15] ^ state[x+20];
    }
    const D: bigint[] = [];
    for (let x = 0; x < 5; x++) {
      D[x] = C[(x+4)%5] ^ (((C[(x+1)%5] << 1n) | (C[(x+1)%5] >> 63n)) & 0xFFFFFFFFFFFFFFFFn);
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        state[x + y*5] ^= D[x];
      }
    }
    // Rho + Pi
    const B: bigint[] = new Array(25).fill(0n);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        const idx = x + y*5;
        const offset = RHO_OFFSETS[idx];
        if (offset === 0) {
          B[y + ((2*x + 3*y) % 5)*5] = state[idx];
        } else {
          B[y + ((2*x + 3*y) % 5)*5] =
            ((state[idx] << BigInt(offset)) | (state[idx] >> BigInt(64 - offset))) & 0xFFFFFFFFFFFFFFFFn;
        }
      }
    }
    // Chi
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        state[x + y*5] = B[x + y*5] ^ ((~B[(x+1)%5 + y*5]) & B[(x+2)%5 + y*5]);
      }
    }
    // Iota
    state[0] ^= RC[round];
  }
}

export function keccak256(data: Uint8Array): Uint8Array {
  // Rate = 1088 bits = 136 bytes, capacity = 512 bits, output = 256 bits
  const rate = 136;
  const state: bigint[] = new Array(25).fill(0n);

  // Absorbing phase
  const padded = new Uint8Array(Math.ceil((data.length + 1) / rate) * rate);
  padded.set(data);
  padded[data.length] = 0x01;
  padded[padded.length - 1] |= 0x80;

  for (let offset = 0; offset < padded.length; offset += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = 0n;
      for (let j = 0; j < 8; j++) {
        lane |= BigInt(padded[offset + i*8 + j]) << BigInt(j * 8);
      }
      state[i] ^= lane;
    }
    keccakf(state);
  }

  // Squeezing phase — output 32 bytes
  const output = new Uint8Array(32);
  for (let i = 0; i < 4; i++) {
    const lane = state[i];
    for (let j = 0; j < 8; j++) {
      output[i*8 + j] = Number((lane >> BigInt(j*8)) & 0xFFn);
    }
  }
  return output;
}

// --- Hex utilities ---

export function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert a SHA-256 hex fingerprint (64 hex chars, no 0x prefix) to a bytes32
 * hex string with 0x prefix. The underlying 32-byte digest is unchanged.
 */
export function fingerprintToBytes32(fingerprint: string): string {
  const clean = fingerprint.replace(/^0x/, '').toLowerCase();
  if (clean.length !== 64 || !/^[0-9a-f]+$/.test(clean)) {
    throw new Error('Fingerprint must be 64 hex characters (SHA-256).');
  }
  return '0x' + clean;
}

/**
 * Hash a CarbonProof record ID (UUID string) using keccak256, following the
 * standard Ethereum hashing convention. Returns a bytes32 hex string.
 */
export function hashRecordId(recordId: string): string {
  const encoded = new TextEncoder().encode(recordId);
  return bytesToHex(keccak256(encoded));
}

/**
 * Validate that a string is a valid EVM (Ethereum) address.
 */
export function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

// --- Function selector computation ---

function computeSelector(signature: string): string {
  const encoded = new TextEncoder().encode(signature);
  const hash = keccak256(encoded);
  return '0x' + Array.from(hash.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const SELECTOR_REGISTER = computeSelector('registerEvidence(bytes32,bytes32)');
const SELECTOR_IS_REGISTERED = computeSelector('isRegistered(bytes32)');
const SELECTOR_GET_REGISTRATION = computeSelector('getRegistration(bytes32)');

// --- ABI encoding ---

function encodeBytes32(hex32: string): string {
  const clean = hex32.replace(/^0x/, '').toLowerCase();
  return clean.padStart(64, '0');
}

function encodeRegisterCall(fingerprint32: string, recordIdHash32: string): string {
  return SELECTOR_REGISTER + encodeBytes32(fingerprint32) + encodeBytes32(recordIdHash32);
}

function encodeIsRegisteredCall(fingerprint32: string): string {
  return SELECTOR_IS_REGISTERED + encodeBytes32(fingerprint32);
}

function encodeGetRegistrationCall(fingerprint32: string): string {
  return SELECTOR_GET_REGISTRATION + encodeBytes32(fingerprint32);
}

// --- ABI decoding ---

function decodeBool(result: string): boolean {
  const clean = result.replace(/^0x/, '').toLowerCase();
  // bool is padded to 32 bytes; last byte is the value
  return clean.length >= 64 && clean[63] === '1';
}

function decodeGetRegistration(result: string): OnChainRegistration {
  const clean = result.replace(/^0x/, '').toLowerCase();
  if (clean.length < 256) {
    // Need 4 × 32-byte return values = 128 bytes = 256 hex chars
    return { registered: false, recordIdHash: null, registrar: null, registeredAt: null };
  }
  const recordIdHash = '0x' + clean.slice(0, 64);
  const registrarRaw = clean.slice(64, 128);
  const registrar = '0x' + registrarRaw.slice(24); // address is last 20 bytes of 32
  const registeredAtHex = clean.slice(128, 192);
  const existsHex = clean.slice(192, 256);
  const exists = existsHex[63] === '1';

  if (!exists) {
    return { registered: false, recordIdHash: null, registrar: null, registeredAt: null };
  }

  const registeredAt = parseInt(registeredAtHex, 16);
  const isZeroAddress = registrarRaw.slice(24) === '0'.repeat(40);
  return {
    registered: true,
    recordIdHash,
    registrar: isZeroAddress ? null : registrar,
    registeredAt: Number.isNaN(registeredAt) ? null : registeredAt,
  };
}

// --- Configuration ---

export function getContractConfig(): ContractConfig {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  const address = (env.VITE_CARBONPROOF_CONTRACT_ADDRESS as string | undefined)
    ?? (typeof process !== 'undefined' ? process.env?.VITE_CARBONPROOF_CONTRACT_ADDRESS : undefined);
  const rpcUrl = (env.VITE_SEPOLIA_RPC_URL as string | undefined)
    ?? (typeof process !== 'undefined' ? process.env?.VITE_SEPOLIA_RPC_URL : undefined)
    ?? DEFAULT_SEPOLIA_RPC_URL;
  const valid = address ? isValidAddress(address) : false;
  return {
    configured: valid,
    address: valid ? address! : null,
    rpcUrl,
  };
}

// --- JSON-RPC helpers ---

async function rpcCall(rpcUrl: string, method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) {
    throw new Error(`RPC HTTP ${response.status}`);
  }
  const json = await response.json();
  if (json.error) {
    throw new Error(`RPC error: ${json.error.message ?? 'unknown'}`);
  }
  return json.result;
}

// --- Wallet management ---

export function getInjectedProvider(): EIP1193Provider | null {
  if (typeof window === 'undefined') return null;
  return window.ethereum ?? null;
}

export function isWalletAvailable(): boolean {
  return getInjectedProvider() !== null;
}

export async function connectWallet(): Promise<WalletState> {
  const provider = getInjectedProvider();
  if (!provider) {
    return {
      available: false,
      connected: false,
      address: null,
      chainId: null,
      isSepolia: false,
    };
  }

  let accounts: string[];
  try {
    const result = await provider.request({ method: 'eth_requestAccounts' });
    accounts = result as string[];
  } catch {
    throw { error: 'WALLET_CONNECTION_REJECTED', message: 'The wallet connection request was rejected.' } as BlockchainErrorResult;
  }

  let chainId: string;
  try {
    chainId = (await provider.request({ method: 'eth_chainId' })) as string;
  } catch {
    chainId = '0x0';
  }

  const chainIdDec = parseInt(chainId, 16);
  const address = accounts[0] ?? null;

  return {
    available: true,
    connected: address !== null,
    address,
    chainId: chainIdDec,
    isSepolia: chainIdDec === SEPOLIA_CHAIN_ID_DEC,
  };
}

export async function getWalletState(): Promise<WalletState> {
  const provider = getInjectedProvider();
  if (!provider) {
    return {
      available: false,
      connected: false,
      address: null,
      chainId: null,
      isSepolia: false,
    };
  }

  let accounts: string[];
  try {
    accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
  } catch {
    accounts = [];
  }

  let chainId: string;
  try {
    chainId = (await provider.request({ method: 'eth_chainId' })) as string;
  } catch {
    chainId = '0x0';
  }

  const chainIdDec = parseInt(chainId, 16);
  const address = accounts[0] ?? null;

  return {
    available: true,
    connected: address !== null,
    address,
    chainId: chainIdDec,
    isSepolia: chainIdDec === SEPOLIA_CHAIN_ID_DEC,
  };
}

export async function switchToSepolia(): Promise<boolean> {
  const provider = getInjectedProvider();
  if (!provider) return false;

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SEPOLIA_CHAIN_ID }],
    });
    return true;
  } catch (err) {
    // Error code 4902 = chain not added to wallet
    const e = err as { code?: number };
    if (e.code === 4902) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [SEPOLIA_NETWORK_PARAMS],
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

// --- Read-only contract queries (via RPC, no wallet needed) ---

async function ethCall(rpcUrl: string, to: string, data: string): Promise<string> {
  const result = await rpcCall(rpcUrl, 'eth_call', [{ to, data }, 'latest']);
  return result as string;
}

export async function checkIsRegistered(
  fingerprint: string,
  config?: ContractConfig
): Promise<OnChainRegistration> {
  const cfg = config ?? getContractConfig();
  if (!cfg.configured || !cfg.address) {
    return { registered: false, recordIdHash: null, registrar: null, registeredAt: null };
  }

  const fp32 = fingerprintToBytes32(fingerprint);
  const data = encodeIsRegisteredCall(fp32);

  let result: string;
  try {
    result = await ethCall(cfg.rpcUrl, cfg.address, data);
  } catch (err) {
    throw {
      error: 'RPC_ERROR',
      message: err instanceof Error ? err.message : 'Failed to read contract state.',
    } as BlockchainErrorResult;
  }

  if (result === '0x' || result === '0x0') {
    return { registered: false, recordIdHash: null, registrar: null, registeredAt: null };
  }

  // If isRegistered returns true, fetch the full registration details.
  if (decodeBool(result)) {
    return await getRegistrationDetails(fingerprint, cfg);
  }

  return { registered: false, recordIdHash: null, registrar: null, registeredAt: null };
}

export async function getRegistrationDetails(
  fingerprint: string,
  config?: ContractConfig
): Promise<OnChainRegistration> {
  const cfg = config ?? getContractConfig();
  if (!cfg.configured || !cfg.address) {
    return { registered: false, recordIdHash: null, registrar: null, registeredAt: null };
  }

  const fp32 = fingerprintToBytes32(fingerprint);
  const data = encodeGetRegistrationCall(fp32);

  let result: string;
  try {
    result = await ethCall(cfg.rpcUrl, cfg.address, data);
  } catch (err) {
    throw {
      error: 'RPC_ERROR',
      message: err instanceof Error ? err.message : 'Failed to read registration details.',
    } as BlockchainErrorResult;
  }

  if (result === '0x' || result === '0x0') {
    return { registered: false, recordIdHash: null, registrar: null, registeredAt: null };
  }

  return decodeGetRegistration(result);
}

/**
 * Performs a lightweight check that the contract exists at the configured
 * address by calling isRegistered with a zero fingerprint. If the contract
 * reverts or returns no data, it is considered unavailable.
 */
export async function checkContractAvailable(
  config?: ContractConfig
): Promise<boolean> {
  const cfg = config ?? getContractConfig();
  if (!cfg.configured || !cfg.address) return false;

  // Use a non-zero dummy fingerprint to check the contract responds.
  const dummyFp = '0x' + '01'.repeat(32);
  const data = encodeIsRegisteredCall(dummyFp);

  try {
    const result = await ethCall(cfg.rpcUrl, cfg.address, data);
    return result !== '0x' && result.length >= 66;
  } catch {
    return false;
  }
}

// --- EIP-7702 delegation detection ---

const EIP7702_DELEGATION_PREFIX = '0xef0100';

/**
 * Detects whether the connected wallet address has EIP-7702 delegation code.
 * When MetaMask's smart account feature is active, the user's EOA gets
 * delegation code (0xef0100 + 20-byte implementation address). Transactions
 * routed through the resulting smart account revert because the smart
 * account's internal logic doesn't properly handle our contract's call.
 *
 * Returns the raw code string from eth_getCode. An EOA returns "0x".
 */
async function getWalletCode(
  provider: EIP1193Provider,
  address: string
): Promise<string> {
  const result = await provider.request({
    method: 'eth_getCode',
    params: [address, 'latest'],
  });
  return result as string;
}

export function isEip7702Delegated(code: string): boolean {
  return code.toLowerCase().startsWith(EIP7702_DELEGATION_PREFIX);
}

// --- Transaction submission (via wallet) ---

function ensureWalletAndChain(state: WalletState): void {
  if (!state.available) {
    throw { error: 'WALLET_NOT_FOUND', message: 'No EIP-1193 wallet was detected. Install MetaMask to register evidence on-chain.' } as BlockchainErrorResult;
  }
  if (!state.connected || !state.address) {
    throw { error: 'WALLET_CONNECTION_REJECTED', message: 'No wallet account is connected.' } as BlockchainErrorResult;
  }
  if (!state.isSepolia) {
    throw { error: 'WRONG_CHAIN', message: `Connected to chain ${state.chainId}. Switch to Ethereum Sepolia (chain ID ${SEPOLIA_CHAIN_ID_DEC}) to register evidence.` } as BlockchainErrorResult;
  }
}

export async function registerEvidenceOnChain(
  fingerprint: string,
  recordId: string,
  walletState: WalletState
): Promise<RegisterResult> {
  const cfg = getContractConfig();
  if (!cfg.configured || !cfg.address) {
    throw {
      error: 'CONTRACT_NOT_CONFIGURED',
      message: 'No contract address is configured. Set VITE_CARBONPROOF_CONTRACT_ADDRESS in your environment.',
    } as BlockchainErrorResult;
  }

  ensureWalletAndChain(walletState);

  const provider = getInjectedProvider()!;

  // Preflight: detect EIP-7702 wallet delegation before sending any transaction.
  // When delegation is active, MetaMask routes the transaction through a smart
  // account that reverts. We must stop here to prevent wasted gas.
  let walletCode: string;
  try {
    walletCode = await getWalletCode(provider, walletState.address!);
  } catch (err) {
    throw {
      error: 'PREFLIGHT_CHECK_FAILED',
      message: `Unable to verify wallet state before registration: ${err instanceof Error ? err.message : 'eth_getCode failed'}. Check your network connection and try again.`,
    } as BlockchainErrorResult;
  }

  if (isEip7702Delegated(walletCode)) {
    throw {
      error: 'EIP7702_DELEGATION_ACTIVE',
      message: 'Wallet delegation (EIP-7702) is active on this account. The connected wallet is using a smart account that cannot submit evidence registrations. Disable the EIP-7702 smart account delegation in your wallet settings and try again.',
    } as BlockchainErrorResult;
  }

  const fp32 = fingerprintToBytes32(fingerprint);
  const recordIdHash = hashRecordId(recordId);
  const data = encodeRegisterCall(fp32, recordIdHash);

  let txHash: string;

  // Preflight: check if already registered (the contract is the final authority,
  // but this avoids unnecessary transactions).
  try {
    const existing = await checkIsRegistered(fingerprint, cfg);
    if (existing.registered) {
      throw {
        error: 'ALREADY_REGISTERED',
        message: `This evidence fingerprint is already registered on-chain by ${existing.registrar ?? 'an unknown address'}.`,
      } as BlockchainErrorResult;
    }
  } catch (err) {
    // If the preflight RPC check fails, let the user proceed — the contract
    // is the final authority. But re-throw if it's an ALREADY_REGISTERED result.
    if ((err as BlockchainErrorResult).error === 'ALREADY_REGISTERED') {
      throw err;
    }
  }

  // Send transaction via wallet
  try {
    txHash = (await provider.request({
      method: 'eth_sendTransaction',
      params: [{
        from: walletState.address,
        to: cfg.address,
        data,
      }],
    })) as string;
  } catch (err) {
    const e = err as { code?: number; message?: string };
    if (e.code === 4001 || e.code === -32603) {
      throw {
        error: 'TRANSACTION_REJECTED',
        message: 'The transaction was rejected in the wallet.',
      } as BlockchainErrorResult;
    }
    if (e.message?.includes('insufficient funds')) {
      throw {
        error: 'INSUFFICIENT_FUNDS',
        message: 'The connected wallet has insufficient Sepolia ETH for gas.',
      } as BlockchainErrorResult;
    }
    throw {
      error: 'TRANSACTION_REJECTED',
      message: e.message ?? 'The transaction could not be submitted.',
    } as BlockchainErrorResult;
  }

  // Wait for receipt
  const receipt = await waitForReceipt(txHash, cfg.rpcUrl, walletState.address!);

  if (!receipt.status) {
    throw {
      error: 'TRANSACTION_FAILED',
      message: `Transaction ${txHash} was mined but reverted. This may indicate a duplicate registration or a contract error.`,
    } as BlockchainErrorResult;
  }

  return { receipt, recordIdHash };
}

async function waitForReceipt(
  txHash: string,
  rpcUrl: string,
  _fromAddress: string,
  maxAttempts = 60,
  intervalMs = 3000
): Promise<RegistrationReceipt> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await rpcCall(rpcUrl, 'eth_getTransactionReceipt', [txHash]);
      if (result && typeof result === 'object') {
        const r = result as {
          status: string;
          blockNumber: string;
          gasUsed: string;
          effectiveGasPrice: string;
        };
        if (r.status !== undefined) {
          return {
            transactionHash: txHash,
            blockNumber: parseInt(r.blockNumber, 16),
            status: r.status === '0x1',
            gasUsed: parseInt(r.gasUsed, 16),
            effectiveGasPrice: r.effectiveGasPrice ?? '0x0',
          };
        }
      }
    } catch {
      // RPC error — retry
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw {
    error: 'TIMEOUT',
    message: `Timed out waiting for transaction receipt for ${txHash}. Check Sepolia Etherscan manually.`,
  } as BlockchainErrorResult;
}

// --- Etherscan links ---

export function etherscanTxUrl(txHash: string): string {
  return `${SEPOLIA_EXPLORER_TX}/${txHash}`;
}

export function etherscanContractUrl(address: string): string {
  return `${SEPOLIA_EXPLORER_ADDR}/${address}`;
}

// --- Formatting helpers ---

export function formatTimestamp(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function isBlockchainErrorResult(value: unknown): value is BlockchainErrorResult {
  return typeof value === 'object' && value !== null && 'error' in value && 'message' in value;
}

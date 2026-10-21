import { useEffect, useState, useCallback } from 'react';
import {
  Loader2,
  Link2,
  ExternalLink,
  Wallet,
  Network,
  CheckCircle2,
  AlertCircle,
  Info,
  ShieldAlert,
  Lock,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import type { EvidenceRecord } from '@/lib/types';
import {
  type WalletState,
  type OnChainRegistration,
  type ContractConfig,
  type RegistrationReceipt,
  getContractConfig,
  getWalletState,
  connectWallet,
  switchToSepolia,
  checkIsRegistered,
  checkContractAvailable,
  registerEvidenceOnChain,
  etherscanTxUrl,
  etherscanContractUrl,
  formatTimestamp,
  shortenAddress,
  isBlockchainErrorResult,
} from '@/lib/blockchain';
import {
  getBlockchainRegistrations,
  saveBlockchainRegistration,
  logBlockchainEvent,
  type StoredBlockchainRegistration,
} from '@/lib/blockchainRepository';
import { Badge, Card } from '@/components/ui';

type RegistrationStatus =
  | 'idle'
  | 'checking'
  | 'not-registered'
  | 'already-registered'
  | 'submitting'
  | 'confirmed'
  | 'error';

interface BlockchainSectionState {
  wallet: WalletState;
  contractConfig: ContractConfig;
  contractAvailable: boolean | null;
  onChain: OnChainRegistration | null;
  localRegistrations: StoredBlockchainRegistration[];
  status: RegistrationStatus;
  error: string | null;
  receipt: RegistrationReceipt | null;
  persistError: string | null;
}

export function BlockchainSection({
  record,
  onEventsChanged,
}: {
  record: EvidenceRecord;
  onEventsChanged: () => void;
}) {
  const [state, setState] = useState<BlockchainSectionState>({
    wallet: {
      available: false,
      connected: false,
      address: null,
      chainId: null,
      isSepolia: false,
    },
    contractConfig: getContractConfig(),
    contractAvailable: null,
    onChain: null,
    localRegistrations: [],
    status: 'idle',
    error: null,
    receipt: null,
    persistError: null,
  });

  const refreshWallet = useCallback(async () => {
    const w = await getWalletState();
    setState((prev) => ({ ...prev, wallet: w }));
  }, []);

  const refreshOnChain = useCallback(async () => {
    if (!state.contractConfig.configured) {
      setState((prev) => ({
        ...prev,
        onChain: null,
        contractAvailable: null,
        status: 'idle',
      }));
      return;
    }
    setState((prev) => ({ ...prev, status: 'checking' }));
    try {
      const [available, onChain, localRegs] = await Promise.all([
        checkContractAvailable(state.contractConfig),
        checkIsRegistered(record.fingerprint, state.contractConfig),
        getBlockchainRegistrations(record.id),
      ]);
      setState((prev) => ({
        ...prev,
        contractAvailable: available,
        onChain,
        localRegistrations: localRegs,
        status: onChain.registered ? 'already-registered' : 'not-registered',
        error: null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        contractAvailable: false,
        status: 'error',
        error: isBlockchainErrorResult(err)
          ? err.message
          : 'Failed to read on-chain state.',
      }));
    }
  }, [record.fingerprint, record.id, state.contractConfig]);

  useEffect(() => {
    refreshWallet();
    refreshOnChain();
  }, [refreshWallet, refreshOnChain]);

  // Listen for wallet account/chain changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    const handler = () => refreshWallet();
    window.ethereum.on?.('accountsChanged', handler);
    window.ethereum.on?.('chainChanged', handler);
    return () => {
      window.ethereum?.removeListener?.('accountsChanged', handler);
      window.ethereum?.removeListener?.('chainChanged', handler);
    };
  }, [refreshWallet]);

  const handleConnectWallet = async () => {
    try {
      const w = await connectWallet();
      setState((prev) => ({ ...prev, wallet: w }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: isBlockchainErrorResult(err)
          ? err.message
          : 'Could not connect wallet.',
      }));
    }
  };

  const handleSwitchNetwork = async () => {
    const ok = await switchToSepolia();
    if (ok) {
      await refreshWallet();
    } else {
      setState((prev) => ({
        ...prev,
        error: 'Could not switch to Sepolia. Please switch manually in MetaMask.',
      }));
    }
  };

  const handleRegister = async () => {
    if (state.status === 'submitting') return; // prevent repeated clicks
    setState((prev) => ({ ...prev, status: 'submitting', error: null, persistError: null }));

    try {
      const result = await registerEvidenceOnChain(
        record.fingerprint,
        record.id,
        state.wallet
      );

      // Try to save the transaction reference locally.
      const saved = await saveBlockchainRegistration({
        record_id: record.id,
        evidence_fingerprint: record.fingerprint,
        record_id_hash: result.recordIdHash,
        transaction_hash: result.receipt.transactionHash,
        block_number: result.receipt.blockNumber,
        registrar_address: state.wallet.address!,
        contract_address: state.contractConfig.address!,
        network: 'sepolia',
      });

      // Log the audit event.
      await logBlockchainEvent(
        record.id,
        `Evidence fingerprint registered on-chain. Tx: ${result.receipt.transactionHash}, block: ${result.receipt.blockNumber}.`,
        'info',
        'On-chain registration proves the fingerprint was registered, not that the claim is truthful.'
      );

      if (!saved) {
        // Local persistence failed but on-chain transaction succeeded.
        // Preserve the actual tx hash and explain the failure.
        setState((prev) => ({
          ...prev,
          status: 'confirmed',
          receipt: result.receipt,
          persistError:
            'The transaction succeeded on-chain but the transaction reference could not be saved locally. The transaction hash is shown below — save it manually if needed.',
        }));
      } else {
        setState((prev) => ({
          ...prev,
          status: 'confirmed',
          receipt: result.receipt,
          persistError: null,
        }));
      }

      // Refresh on-chain state to verify the registration.
      await refreshOnChain();
      onEventsChanged();
    } catch (err) {
      if (isBlockchainErrorResult(err)) {
        if (err.error === 'ALREADY_REGISTERED') {
          setState((prev) => ({
            ...prev,
            status: 'already-registered',
            error: err.message,
          }));
          await refreshOnChain();
        } else {
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: err.message,
          }));
        }
        // Log error events for non-rejected transactions
        if (err.error !== 'TRANSACTION_REJECTED' && err.error !== 'ALREADY_REGISTERED') {
          await logBlockchainEvent(record.id, `Blockchain registration failed: ${err.message}`, 'warning');
          onEventsChanged();
        }
      } else {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error.',
        }));
      }
    }
  };

  const { contractConfig, wallet, onChain, status, contractAvailable } = state;

  // --- Render ---

  return (
    <Card className="border-violet-900/30 p-5">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-violet-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">
          Blockchain Registration
        </h2>
        {onChain?.registered && (
          <Badge classes="bg-emerald-900/40 text-emerald-200 border-emerald-700/60" dot="bg-emerald-400">
            On-Chain
          </Badge>
        )}
        {status === 'not-registered' && (
          <Badge classes="bg-stone-700/60 text-stone-300 border-stone-600">
            Not Registered
          </Badge>
        )}
      </div>

      {/* Network + contract config */}
      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-stone-300">
          <Network className="h-4 w-4 text-stone-500" />
          <span className="text-stone-500">Network:</span>
          <span>Ethereum Sepolia (Chain ID 11155111)</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-stone-500">Contract:</span>
          {contractConfig.configured ? (
            <a
              href={etherscanContractUrl(contractConfig.address!)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs text-violet-300 hover:text-violet-200 hover:underline"
            >
              {shortenAddress(contractConfig.address!)}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="text-amber-300">Not configured</span>
          )}
        </div>
      </div>

      {/* Contract not configured */}
      {!contractConfig.configured && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-800/50 bg-amber-900/10 p-3 text-sm text-amber-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Smart contract not configured</p>
            <p className="mt-0.5 text-xs text-amber-200/80">
              Set <code className="rounded bg-amber-900/40 px-1">VITE_CARBONPROOF_CONTRACT_ADDRESS</code> in your
              environment to the deployed Sepolia contract address. See{' '}
              <code className="rounded bg-amber-900/40 px-1">contracts/DEPLOYMENT.md</code> for deployment instructions.
            </p>
          </div>
        </div>
      )}

      {/* Contract configured but unavailable */}
      {contractConfig.configured && contractAvailable === false && status !== 'submitting' && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-800/60 bg-red-900/20 p-3 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Contract unavailable</p>
            <p className="mt-0.5 text-xs text-red-200/80">
              The configured address did not respond to a contract read call. The contract may not be deployed at
              this address, or the RPC endpoint is unreachable.
            </p>
          </div>
        </div>
      )}

      {/* Wallet status */}
      {contractConfig.configured && (
        <div className="mt-4 rounded-lg border border-stone-700/60 bg-stone-900/40 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Wallet className="h-4 w-4 text-stone-500" />
              {wallet.connected && wallet.address ? (
                <span className="font-mono text-xs text-stone-300">
                  {shortenAddress(wallet.address)}
                </span>
              ) : wallet.available ? (
                <span className="text-stone-400">Wallet detected, not connected</span>
              ) : (
                <span className="text-stone-400">No wallet detected</span>
              )}
            </div>
            {!wallet.connected && wallet.available && (
              <button
                onClick={handleConnectWallet}
                className="rounded-md border border-violet-700/60 bg-violet-900/30 px-3 py-1 text-xs font-medium text-violet-200 hover:bg-violet-900/50"
              >
                Connect Wallet
              </button>
            )}
            {!wallet.available && (
              <span className="text-xs text-stone-500">Install MetaMask</span>
            )}
          </div>
          {wallet.connected && !wallet.isSepolia && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-amber-300">
                Wrong network (chain {wallet.chainId}). Sepolia required.
              </span>
              <button
                onClick={handleSwitchNetwork}
                className="rounded-md border border-amber-700/60 bg-amber-900/30 px-3 py-1 text-xs font-medium text-amber-200 hover:bg-amber-900/50"
              >
                Switch to Sepolia
              </button>
            </div>
          )}
          {wallet.connected && wallet.isSepolia && (
            <p className="mt-2 text-xs text-emerald-300">Connected to Sepolia</p>
          )}
        </div>
      )}

      {/* On-chain status */}
      {contractConfig.configured && contractAvailable !== false && (
        <div className="mt-4 rounded-lg border border-stone-700/60 bg-stone-900/40 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
              On-Chain Registration Status
            </p>
            <button
              onClick={refreshOnChain}
              disabled={state.status === 'checking'}
              className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-stone-200 disabled:opacity-60"
            >
              {state.status === 'checking' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Refresh
            </button>
          </div>

          {state.status === 'checking' && (
            <p className="mt-2 flex items-center gap-2 text-sm text-stone-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking contract state…
            </p>
          )}

          {onChain?.registered && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2 text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Registered on-chain
              </div>
              <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-stone-500">Registrar</dt>
                  <dd className="font-mono text-stone-300">
                    {onChain.registrar ? shortenAddress(onChain.registrar) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">Registered at</dt>
                  <dd className="text-stone-300">
                    {onChain.registeredAt ? formatTimestamp(onChain.registeredAt) : '—'}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-stone-500">Record ID hash (on-chain)</dt>
                  <dd className="break-all font-mono text-stone-400">{onChain.recordIdHash}</dd>
                </div>
              </dl>
            </div>
          )}

          {status === 'not-registered' && !state.receipt && (
            <p className="mt-2 text-sm text-stone-400">
              This evidence fingerprint has not been registered on-chain yet.
            </p>
          )}
        </div>
      )}

      {/* Register button */}
      {contractConfig.configured &&
        contractAvailable !== false &&
        !onChain?.registered &&
        status !== 'submitting' &&
        status !== 'checking' && (
          <button
            onClick={handleRegister}
            disabled={!wallet.connected || !wallet.isSepolia}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-700/60 bg-violet-900/30 px-4 py-2.5 text-sm font-semibold text-violet-200 hover:bg-violet-900/50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <Lock className="h-4 w-4" />
            Register Evidence On-Chain
          </button>
        )}

      {/* Submitting state */}
      {status === 'submitting' && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-violet-800/50 bg-violet-900/15 p-4 text-sm text-violet-200">
          <Loader2 className="h-5 w-5 animate-spin" />
          Waiting for wallet confirmation and transaction mining…
        </div>
      )}

      {/* Confirmed receipt */}
      {state.receipt && state.status === 'confirmed' && (
        <div className="mt-4 rounded-lg border border-emerald-800/50 bg-emerald-900/15 p-4">
          <div className="flex items-center gap-2 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">Transaction confirmed on Sepolia</span>
          </div>
          <dl className="mt-2 space-y-1 text-xs">
            <div>
              <dt className="text-stone-500">Transaction hash</dt>
              <dd className="break-all font-mono text-stone-300">
                <a
                  href={etherscanTxUrl(state.receipt.transactionHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200 hover:underline"
                >
                  {state.receipt.transactionHash}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Block number</dt>
              <dd className="text-stone-300">{state.receipt.blockNumber.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Gas used</dt>
              <dd className="text-stone-300">{state.receipt.gasUsed.toLocaleString()}</dd>
            </div>
          </dl>
          {state.persistError && (
            <p className="mt-2 text-xs text-amber-200">{state.persistError}</p>
          )}
        </div>
      )}

      {/* Error state */}
      {state.error && status === 'error' && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-800/60 bg-red-900/20 p-3 text-sm text-red-200">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Registration failed</p>
            <p className="mt-0.5 text-xs text-red-200/80">{state.error}</p>
            <p className="mt-1 text-xs text-red-200/60">
              The record and all previous audit history are preserved.
            </p>
          </div>
        </div>
      )}

      {/* Already registered error (from attempted duplicate) */}
      {state.error && status === 'already-registered' && !onChain?.registered && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-800/50 bg-amber-900/15 p-3 text-sm text-amber-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-xs">{state.error}</p>
        </div>
      )}

      {/* Local transaction references */}
      {state.localRegistrations.length > 0 && (
        <div className="mt-4 border-t border-stone-800 pt-3">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
            Locally Stored Transaction References
          </p>
          <ul className="mt-2 space-y-1">
            {state.localRegistrations.map((reg) => (
              <li key={reg.id} className="text-xs text-stone-400">
                <a
                  href={etherscanTxUrl(reg.transaction_hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-violet-300 hover:text-violet-200 hover:underline"
                >
                  {reg.transaction_hash.slice(0, 18)}…
                  <Link2 className="h-3 w-3" />
                </a>
                <span className="ml-2 text-stone-500">block {reg.block_number.toLocaleString()}</span>
                {reg.local_persist_error && (
                  <span className="ml-2 text-amber-300">(local save failed)</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-stone-500">
            These are locators, not proof. On-chain status above is read from the live contract.
          </p>
        </div>
      )}

      {/* Advisory notice */}
      <div className="mt-4 rounded-lg border border-amber-800/40 bg-amber-900/10 p-3">
        <p className="flex items-center gap-2 text-xs text-amber-200">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
          On-chain registration proves that a fingerprint was registered by a wallet
          at a time. It does <strong>not</strong> prove that the associated
          environmental claim is true, verified, or certified.
        </p>
      </div>
    </Card>
  );
}

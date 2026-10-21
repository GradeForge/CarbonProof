import { useEffect, useState } from 'react';
import { Loader2, Lock, CheckCircle2, XCircle, AlertCircle, ExternalLink, Info, ShieldAlert } from 'lucide-react';
import {
  type OnChainRegistration,
  type ContractConfig,
  checkIsRegistered,
  checkContractAvailable,
  getContractConfig,
  etherscanTxUrl,
  etherscanContractUrl,
  formatTimestamp,
  shortenAddress,
  isBlockchainErrorResult,
} from '@/lib/blockchain';
import {
  getBlockchainRegistrations,
  type StoredBlockchainRegistration,
} from '@/lib/blockchainRepository';
import { Badge, Card } from '@/components/ui';

type OnChainStatus = 'checking' | 'registered' | 'not-registered' | 'unavailable';

export function BlockchainVerification({ recordId, fingerprint }: { recordId: string; fingerprint: string }) {
  const [status, setStatus] = useState<OnChainStatus>('checking');
  const [onChain, setOnChain] = useState<OnChainRegistration | null>(null);
  const [config, setConfig] = useState<ContractConfig>(getContractConfig());
  const [localRegs, setLocalRegs] = useState<StoredBlockchainRegistration[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cfg = getContractConfig();
      setConfig(cfg);
      if (!cfg.configured) {
        setStatus('unavailable');
        return;
      }
      try {
        const available = await checkContractAvailable(cfg);
        if (cancelled) return;
        if (!available) {
          setStatus('unavailable');
          setError('The contract did not respond. It may not be deployed at the configured address, or the RPC endpoint is unreachable.');
          return;
        }
        const [onChainResult, regs] = await Promise.all([
          checkIsRegistered(fingerprint, cfg),
          getBlockchainRegistrations(recordId),
        ]);
        if (cancelled) return;
        setOnChain(onChainResult);
        setLocalRegs(regs);
        setStatus(onChainResult.registered ? 'registered' : 'not-registered');
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setStatus('unavailable');
        setError(
          isBlockchainErrorResult(err)
            ? err.message
            : 'Blockchain verification unavailable.'
        );
      }
    })();
    return () => { cancelled = true; };
  }, [recordId, fingerprint]);

  return (
    <Card className="border-violet-900/30 p-4">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-violet-400" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-stone-400">
          Blockchain Verification
        </h3>
        <span className="text-xs text-stone-500">Ethereum Sepolia</span>
      </div>

      {/* Contract not configured */}
      {!config.configured && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-stone-700 bg-stone-900/40 p-3 text-sm text-stone-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
          <div>
            <p className="font-medium">Smart contract not configured</p>
            <p className="mt-0.5 text-xs text-stone-400">
              No contract address is set. Blockchain verification is unavailable for this record.
            </p>
          </div>
        </div>
      )}

      {/* Checking */}
      {config.configured && status === 'checking' && (
        <p className="mt-3 flex items-center gap-2 text-sm text-stone-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking on-chain registration status…
        </p>
      )}

      {/* Unavailable */}
      {config.configured && status === 'unavailable' && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-800/50 bg-amber-900/10 p-3 text-sm text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Blockchain verification unavailable</p>
            <p className="mt-0.5 text-xs text-amber-200/80">
              {error ?? 'The RPC endpoint or contract is not reachable.'}
            </p>
          </div>
        </div>
      )}

      {/* Not registered */}
      {config.configured && status === 'not-registered' && (
        <div className="mt-3 flex items-center gap-2 text-sm text-stone-400">
          <XCircle className="h-4 w-4 text-stone-500" />
          This evidence fingerprint is not registered on-chain.
        </div>
      )}

      {/* Registered */}
      {config.configured && status === 'registered' && onChain?.registered && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-2 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">Registered on-chain</span>
            <Badge classes="bg-emerald-900/40 text-emerald-200 border-emerald-700/60" dot="bg-emerald-400">
              Confirmed
            </Badge>
          </div>
          <dl className="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
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
            {config.address && (
              <div className="sm:col-span-2">
                <dt className="text-stone-500">Contract</dt>
                <dd>
                  <a
                    href={etherscanContractUrl(config.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-violet-300 hover:text-violet-200 hover:underline"
                  >
                    {shortenAddress(config.address)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Local transaction references */}
      {localRegs.length > 0 && (
        <div className="mt-3 border-t border-stone-800 pt-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">
            Transaction References
          </p>
          <ul className="mt-1 space-y-0.5">
            {localRegs.map((reg) => (
              <li key={reg.id} className="text-xs">
                <a
                  href={etherscanTxUrl(reg.transaction_hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-violet-300 hover:text-violet-200 hover:underline"
                >
                  {reg.transaction_hash.slice(0, 18)}…
                  <ExternalLink className="h-3 w-3" />
                </a>
                <span className="ml-2 text-stone-500">block {reg.block_number.toLocaleString()}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[10px] text-stone-500">
            These are locators. On-chain status above is read from the live contract.
          </p>
        </div>
      )}

      {/* Advisory */}
      <div className="mt-3 rounded-md border border-amber-800/40 bg-amber-900/10 p-2">
        <p className="flex items-center gap-1.5 text-[11px] text-amber-200">
          <ShieldAlert className="h-3 w-3 shrink-0" />
          On-chain registration proves a fingerprint was registered, not that the environmental claim is true.
        </p>
      </div>
    </Card>
  );
}

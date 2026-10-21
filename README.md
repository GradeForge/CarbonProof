# CarbonProof

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-ozwz8xhz)

**CarbonProof** is a climate-claim evidence auditing prototype that helps reviewers examine environmental claims through reproducible deterministic checks, evidence fingerprinting, optional AI-assisted review, append-only audit history, and blockchain registration on Ethereum Sepolia.

> **Published demo:** https://carbonproof-climate-c8ne.bolt.host

Built for the **IEEE ClimateChain Global Hackathon 2026**.

---

## Problem

Organisations publish carbon credit and environmental impact claims with varying levels of evidence quality. Reviewers need a structured way to:

- Assess whether submitted evidence meets basic completeness and consistency rules
- Detect duplicate submissions of the same evidence
- Track audit findings over time without losing history
- Optionally register evidence identifiers on a public blockchain for tamper-evident provenance
- Allow public verification that a fingerprint has been registered on-chain

CarbonProof addresses these needs with a deterministic-first approach: rule-based checks run identically every time and are explainable, while AI-assisted review and blockchain registration are optional layers that do not replace human judgement.

---

## Key Features

- **Deterministic rule-based audits** — reproducible checks with explainable findings and suggested actions, run on every submission and re-audit.
- **SHA-256 evidence fingerprinting** — fingerprints of canonicalised evidence fields enable duplicate detection and on-chain registration without exposing the underlying data.
- **Evidence records and append-only audit history** — every audit run, AI review, and blockchain registration is logged as an immutable event. Previous findings are never overwritten.
- **Optional AI evidence auditing** — a server-side edge function sends evidence metadata to an AI provider and returns structured findings. **AI analysis is currently unavailable** until the required `AI_API_KEY` secret is configured. No simulated AI results are ever presented.
- **Ethereum Sepolia blockchain registration** — evidence fingerprints and record ID hashes are registered on-chain via a deployed smart contract, producing a tamper-evident, publicly verifiable timestamp.
- **Public Verification** — anyone can search by database record UUID, evidence fingerprint (SHA-256 hex), or on-chain record ID hash (`0x`-prefixed bytes32) to find a record and view its audit status and blockchain registration.
- **Registration status verification** — the app reads on-chain registration state directly from the deployed contract via JSON-RPC, without requiring a connected wallet.
- **Clear claim boundaries** — every screen states that evidence registration and automated audits do not independently verify, certify, or prove the truth of an environmental claim.

---

## How It Works

### 1. Evidence Submission

A reviewer submits an evidence record with project metadata: organisation ID, claim category, country, location, reporting period, claimed quantity, evidence reference, and a free-text evidence description.

### 2. Deterministic Audit

On submission, the system runs rule-based checks (e.g. required fields, valid reporting period, quantity positivity, URL format for evidence references). Each finding is recorded with a severity, rule ID, affected field, and suggested action. The audit can be re-run at any time — new findings are appended, never replacing previous ones.

### 3. Fingerprinting

A SHA-256 fingerprint is computed over the canonicalised evidence fields. This fingerprint uniquely identifies the evidence content and is used for duplicate detection and on-chain registration. The fingerprint proves the canonical evidence has not been registered before — not that the claim is truthful.

### 4. AI Evidence Audit (Optional)

A reviewer can trigger an AI evidence audit. The edge function sends only the metadata and description to an AI provider (no documents are fetched or uploaded). The AI returns a structured assessment: summary, extracted claim, evidence sufficiency rating, findings, missing information, reviewer questions, and limitations. Results are persisted and logged in the audit history. **If no AI provider credentials are configured, the function returns "unavailable" and no AI response is simulated.**

### 5. Blockchain Registration

A reviewer with a MetaMask wallet connected to Ethereum Sepolia can register the evidence fingerprint and a keccak256 hash of the record ID on-chain via the `CarbonProofRegistry` smart contract. The transaction is signed in the user's wallet — the application never handles private keys. The contract enforces duplicate prevention: the same fingerprint cannot be registered twice.

### 6. Public Verification

Anyone can use the Public Verification page to search for a record by:
- **Database record UUID**
- **Evidence fingerprint** (64-character SHA-256 hex, with or without `0x` prefix)
- **On-chain record ID hash** (`0x` + 64 hex characters)

The search returns the record's status, audit findings summary, and blockchain registration details (registrar address, registration timestamp, transaction hash with Etherscan link).

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 18 with TypeScript |
| Build tool | Vite 5 |
| Styling | Tailwind CSS 3 |
| Icons | Lucide React |
| Backend / database | Supabase (PostgreSQL, Edge Functions) |
| Blockchain | Ethereum Sepolia (JSON-RPC `eth_call`, EIP-1193 wallet interaction) |
| Smart contract | Solidity 0.8.20 (`CarbonProofRegistry.sol`) |
| Testing | Node.js built-in test runner via `tsx --test` |
| Linting | ESLint 9 with TypeScript-eslint |

No external blockchain SDK (e.g. ethers.js) is used — contract interaction is handled via direct JSON-RPC calls and a compact keccak256 implementation, keeping the bundle small.

---

## Local Setup

### Prerequisites

- Node.js 18+ and npm
- A Supabase project (URL and anon key)
- MetaMask browser extension (for blockchain registration only — not needed for read-only verification)

### Installation

```bash
npm install
```

### Environment variables

Create a `.env` file in the project root with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_CARBONPROOF_CONTRACT_ADDRESS=0x3EE0598F868CB849F823CF6f9FeE926153758e1d
VITE_SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
```

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — required for database access. These are public values safe for client-side use.
- `VITE_CARBONPROOF_CONTRACT_ADDRESS` — the deployed `CarbonProofRegistry` contract address on Sepolia.
- `VITE_SEPOLIA_RPC_URL` — optional. Defaults to the same public Sepolia RPC endpoint if not set.

### Edge function: AI audit credentials

The AI audit edge function uses server-side secrets configured in the Supabase dashboard (not in `.env`):

- `AI_API_KEY` — API key for an OpenAI-compatible chat completions endpoint. **Required** for live AI analysis. Without it, the function returns "unavailable."
- `AI_BASE_URL` — optional. Defaults to OpenAI's public endpoint.
- `AI_MODEL` — optional. Defaults to `gpt-4o-mini`.

These secrets are never exposed to the client.

### Database migrations

The Supabase migrations in `supabase/migrations/` create the `evidence_records`, `audit_events`, `ai_audit_results`, and `blockchain_registrations` tables with row-level security policies. Apply them through the Supabase dashboard or MCP tools.

### Running the development server

```bash
npm run dev
```

---

## Testing

```bash
# Run unit tests (110 tests across 3 test files)
npm test

# Type-check the project
npm run typecheck

# Lint
npm run lint

# Production build
npm run build
```

Test files are in `src/lib/__tests__/` and cover:
- `aiSchema.test.ts` — AI audit response validation and sanitisation
- `blockchain.test.ts` — keccak256, ABI encoding, contract config, wallet state
- `searchRecords.test.ts` — public verification search by UUID, fingerprint, and on-chain hash

---

## Blockchain Details

| Item | Value |
|------|-------|
| Network | Ethereum Sepolia (testnet) |
| Chain ID | 11155111 |
| Contract | `CarbonProofRegistry` |
| Contract address | `0x3EE0598F868CB849F823CF6f9FeE926153758e1d` |
| Solidity version | 0.8.20 |
| [Contract on Etherscan](https://sepolia.etherscan.io/address/0x3EE0598F868CB849F823CF6f9FeE926153758e1d) | |
| [Example confirmed transaction](https://sepolia.etherscan.io/tx/0x0b4adb99adace39c764e2b2e3ad919d0a0ea2d0a9d06b4c1ef8d096da24975dc) | |

The contract stores a mapping from evidence fingerprint (bytes32) to a registration struct containing the record ID hash, registrar address, and block timestamp. It enforces:

- No zero fingerprints
- No duplicate registrations (reverts on second attempt)
- No owner or access control (intentional for the prototype)

Deployment instructions are in [`contracts/DEPLOYMENT.md`](contracts/DEPLOYMENT.md).

---

## Limitations

- **Prototype status.** CarbonProof is a hackathon prototype, not a production system. All screens display a "Local Prototype" badge. No environmental claim made through this system should be treated as independently verified or certified.
- **AI analysis is unavailable.** The AI evidence audit requires an `AI_API_KEY` edge function secret that is not currently configured. The UI clearly labels this state and never presents simulated or fake AI results.
- **Blockchain registration does not validate claims.** On-chain registration proves that a fingerprint was registered by a wallet at a point in time. It does **not** prove that the associated environmental claim is true, verified, or certified.
- **No authentication.** The app does not require sign-in. Database row-level security policies are open to the `anon` role by design for the prototype. Before any production use, authentication and ownership-scoped policies would be required.
- **Sample data is demo data.** The four sample records (Highland Reforestation, Coastal Wind Farm, Landfill Methane Capture, Municipal LED Streetlight Retrofit) are fictional and clearly labelled with a "SAMPLE" badge. They must not be presented as verified real-world environmental results.
- **Sepolia is a testnet.** All blockchain transactions use Sepolia test ETH with no real-world value.

---

## Responsible Use and Security

- **Never commit `.env` or secrets to version control.** The `.gitignore` file excludes `.env`. Do not remove this exclusion.
- **No private keys in the app.** The application never handles wallet private keys or recovery phrases. All transaction signing happens in the user's MetaMask wallet via EIP-1193.
- **No service-role keys in client code.** The Supabase service role key is used only server-side in the edge function via `Deno.env.get()`. It is never imported or referenced in frontend code.
- **AI error messages are sanitised.** The edge function strips API key patterns (`sk-*`) and `Bearer` tokens from error messages before returning them to the client.
- **AI prompts send metadata only.** The edge function sends the evidence record's text fields to the AI provider. It does not fetch URLs, upload documents, or transmit credentials.
- **Do not present prototype outputs as certifications.** Audit findings, AI assessments, and blockchain registrations are advisory tools for human reviewers — not independent verification or certification of environmental claims.

---

## Project Structure

```
src/
  components/       AppShell, BlockchainSection, BlockchainVerification, ui
  lib/              repository, blockchain, audit, fingerprint, validation, aiRepository, aiSchema, format, router, types
  pages/            Overview, Registry, NewSubmission, RecordDetail, AuditHistory, PublicVerification
  lib/__tests__/    aiSchema, blockchain, searchRecords unit tests
contracts/
  CarbonProofRegistry.sol    Solidity smart contract
  DEPLOYMENT.md              Deployment guide (Remix + MetaMask)
supabase/
  migrations/                Database schema and RLS policies
  functions/ai-audit/        AI evidence audit edge function
  config.toml                Supabase function configuration
```

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_CARBONPROOF_CONTRACT_ADDRESS?: string;
  readonly VITE_SEPOLIA_RPC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

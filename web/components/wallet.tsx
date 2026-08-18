"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createWalletClient, custom, type Address, type EIP1193Provider, type Hex } from "viem";
import { Wallet, LogOut } from "lucide-react";
import { CHAINS, viemChain, type ChainId } from "@/lib/chain";
import { useToast } from "./toast";

type Ctx = {
  address: Address | null;
  chainId: number | null;
  available: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  ensureChain: (target: ChainId) => Promise<void>;
  send: (args: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args: unknown[];
    value?: bigint;
    gas?: bigint;
    chainId: ChainId;
  }) => Promise<Hex>;
};

const WalletContext = createContext<Ctx | null>(null);

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const eth = window.ethereum;
    setAvailable(Boolean(eth));
    if (!eth) return;

    // Reconnect silently if the site is already authorised.
    eth
      .request({ method: "eth_accounts" })
      .then((accts) => {
        const list = accts as Address[];
        if (list?.[0]) setAddress(list[0]);
      })
      .catch(() => {});
    eth
      .request({ method: "eth_chainId" })
      .then((id) => setChainId(Number(id as string)))
      .catch(() => {});

    const onAccounts = (a: unknown) => setAddress((a as Address[])?.[0] ?? null);
    const onChain = (id: unknown) => setChainId(Number(id as string));
    (eth as unknown as { on?: (e: string, h: (v: unknown) => void) => void }).on?.(
      "accountsChanged",
      onAccounts,
    );
    (eth as unknown as { on?: (e: string, h: (v: unknown) => void) => void }).on?.("chainChanged", onChain);
  }, []);

  const connect = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) throw new Error("No injected wallet found.");
    const accts = (await eth.request({ method: "eth_requestAccounts" })) as Address[];
    setAddress(accts[0] ?? null);
    const id = (await eth.request({ method: "eth_chainId" })) as string;
    setChainId(Number(id));
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    // MetaMask supports revoking the connection permission; other wallets may
    // not — for those, clearing our state is the whole gesture.
    window.ethereum
      ?.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }] as never,
      })
      .catch(() => {});
  }, []);

  /** Switches the wallet to BOT Chain, adding the network if it is unknown. */
  const ensureChain = useCallback(async (target: ChainId) => {
    const eth = window.ethereum;
    if (!eth) throw new Error("No injected wallet found.");
    const hex = `0x${target.toString(16)}`;
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] as never });
    } catch (e) {
      /**
       * EIP-3085 says an unknown chain is code 4902 — but MetaMask in practice
       * often surfaces it as -32603 ("Unrecognized chain ID … Try adding the
       * chain"), sometimes with the 4902 buried in data.originalError. Anything
       * that smells like "the wallet has never heard of this chain" gets the
       * add-chain flow; only genuinely different failures (like the user
       * rejecting the switch, 4001) are rethrown.
       */
      const err = e as {
        code?: number;
        message?: string;
        data?: { originalError?: { code?: number } };
      };
      const unknownChain =
        err.code === 4902 ||
        err.data?.originalError?.code === 4902 ||
        err.code === -32603 ||
        /unrecognized chain|unknown chain|add.*chain/i.test(err.message ?? "");
      if (!unknownChain) throw e;

      const c = CHAINS[target];
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hex,
            chainName: c.name,
            nativeCurrency: { name: "BOT", symbol: c.symbol, decimals: 18 },
            rpcUrls: [c.rpc],
            blockExplorerUrls: [c.explorer],
          },
        ] as never,
      });
      // Adding usually switches as a side effect, but not in every wallet.
      await eth
        .request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] as never })
        .catch(() => {});
    }
    setChainId(target);
  }, []);

  const send = useCallback<Ctx["send"]>(
    async ({ address: to, abi, functionName, args, value, gas, chainId: target }) => {
      const eth = window.ethereum;
      if (!eth) throw new Error("No injected wallet found.");
      if (!address) throw new Error("Connect a wallet first.");
      await ensureChain(target);

      const wallet = createWalletClient({
        account: address,
        chain: viemChain(target),
        transport: custom(eth),
      });
      return wallet.writeContract({
        address: to,
        abi: abi as never,
        functionName: functionName as never,
        args: args as never,
        value,
        ...(gas ? { gas } : {}),
      } as never);
    },
    [address, ensureChain],
  );

  const value = useMemo(
    () => ({ address, chainId, available, connect, disconnect, ensureChain, send }),
    [address, chainId, available, connect, disconnect, ensureChain, send],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

export function ConnectButton({ chainId }: { chainId: ChainId }) {
  const { address, chainId: current, available, connect, disconnect, ensureChain } = useWallet();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const wrongChain = address && current !== null && current !== chainId;

  if (!available) {
    return (
      <span className="hidden font-mono text-[11px] tracking-wide text-ink-faint sm:inline">
        no wallet detected
      </span>
    );
  }

  if (!address) {
    return (
      <button
        onClick={() => {
          setBusy(true);
          connect()
            .then(() => toast({ tone: "sealed", title: "Wallet connected" }))
            .catch(() => toast({ tone: "note", title: "Connection declined" }))
            .finally(() => setBusy(false));
        }}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-brass-deep bg-brass/10 px-3 py-1.5 text-[12.5px] font-medium text-brass-soft transition-colors hover:bg-brass/20 disabled:opacity-60"
      >
        <Wallet className="size-3.5" />
        {busy ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  if (wrongChain) {
    return (
      <button
        onClick={() => {
          setBusy(true);
          // A rejection here is the user declining in the wallet — not an error.
          ensureChain(chainId)
            .then(() => toast({ tone: "sealed", title: `Switched to ${CHAINS[chainId].name}` }))
            .catch(() => toast({ tone: "note", title: "Network switch declined" }))
            .finally(() => setBusy(false));
        }}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-seal-deep bg-seal/10 px-3 py-1.5 text-[12.5px] font-medium text-seal transition-colors hover:bg-seal/20 disabled:opacity-60"
      >
        {busy ? "Confirm in wallet…" : `Switch to ${CHAINS[chainId].name}`}
      </button>
    );
  }

  return (
    <button
      onClick={() => {
        disconnect();
        toast({ tone: "note", title: "Wallet disconnected" });
      }}
      title="Disconnect"
      className="group inline-flex items-center gap-1.5 rounded-lg border border-rule bg-stock-800/70 px-3 py-1.5 font-mono text-[12px] text-ink-soft transition-colors hover:border-rule-bright"
    >
      <span className="size-1.5 rounded-full bg-verd" />
      {address.slice(0, 6)}…{address.slice(-4)}
      <LogOut className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
    </button>
  );
}

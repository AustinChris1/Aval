"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { CHAINS, DEPLOYED_CHAIN_IDS, type ChainId } from "@/lib/chain";
import { useToast } from "./toast";

// Testnet first: it is where the walletless demo keys work.
const OPTIONS = [...DEPLOYED_CHAIN_IDS].sort((a, b) => b - a);

export function ChainSwitcher({ current }: { current: ChainId }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  function choose(id: ChainId) {
    if (id === current || pending) return;
    document.cookie = `aval-chain=${id}; path=/; max-age=31536000; samesite=lax`;
    toast({
      tone: "note",
      title: `${CHAINS[id].name} · ${id}`,
      detail:
        id === 968
          ? "Demo keys work here and nothing is real money."
          : "Real BOT. Demo signing is refused here; actions go through your own wallet.",
    });
    startTransition(() => router.refresh());
  }

  return (
    <span className="inline-flex items-center overflow-hidden rounded-sm border border-rule">
      {OPTIONS.map((id) => {
        const active = id === current;
        return (
          <button
            key={id}
            onClick={() => choose(id)}
            disabled={pending}
            title={`${CHAINS[id].name} · chain ${id}`}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10px] tracking-[0.14em] uppercase transition-colors ${
              active ? "bg-stock-750 text-ink" : "text-ink-faint hover:text-ink-dim"
            }`}
          >
            {active && pending ? (
              <Loader2 className="size-2 animate-spin text-verd" />
            ) : (
              <span
                className={`relative flex size-1.5 ${active ? "" : "opacity-25"}`}
              >
                {active && (
                  <span className="absolute inline-flex size-full animate-seal rounded-full bg-verd" />
                )}
                <span className="relative inline-flex size-1.5 rounded-full bg-verd" />
              </span>
            )}
            {CHAINS[id].name.replace("BOT Chain ", "")} · {id}
          </button>
        );
      })}
    </span>
  );
}

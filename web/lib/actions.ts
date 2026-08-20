import { parseEther, keccak256, stringToHex, type Hex } from "viem";

// Every write AVAL supports, declared once for three consumers: the forms, the wallet path, and the testnet demo signer, so no contract function is quietly unreachable from the UI.

export type FieldType =
  | "address"
  | "ether"
  | "uint"
  | "uint8"
  | "bool"
  | "string"
  | "bytes32"
  | "hex"
  | "json";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  help?: string;
  optional?: boolean;
};

export type Role = "applicant" | "agent" | "validator" | "principal" | "anyone";

export type ActionDef = {
  id: string;
  label: string;
  blurb: string;
  contract: "LetterOfCredit" | "IdentityRegistry" | "ValidationRegistry";
  fn: string;
  role: Role;
  fields: Field[];
  /** Field whose ether amount becomes msg.value. */
  valueField?: string;
  // Manual gas so the transaction is mined as reverted instead of dying in estimation; only used where refusal is the point.
  expectRevert?: boolean;
  tone?: "default" | "seal" | "verd";
};

export const ROLE_LABEL: Record<Role, string> = {
  applicant: "the applicant that issued the credit",
  agent: "the agent's bound wallet",
  validator: "the examiner named at issuance",
  principal: "the agent's owner",
  anyone: "anyone at all",
};

export const ACTIONS: ActionDef[] = [
  // --- the agent acting under mandate -------------------------------------
  {
    id: "payToBlocked",
    label: "Attempt a payment the mandate forbids",
    blurb:
      "Send working capital to an address the applicant never named. This is expected to fail, and it is broadcast with gas supplied manually so the refusal is mined into a block rather than dying in gas estimation. The result is a permanent transaction anyone can open.",
    contract: "LetterOfCredit",
    fn: "payTo",
    role: "agent",
    expectRevert: true,
    tone: "seal",
    fields: [
      { name: "letterId", label: "Credit", type: "uint" },
      {
        name: "recipient",
        label: "Recipient",
        type: "address",
        help: "Any address that is not in the mandate, the agent's own key is the honest demonstration.",
      },
      { name: "amount", label: "Amount", type: "ether", placeholder: "0.1" },
    ],
  },
  {
    id: "payTo",
    label: "Pay a named recipient",
    blurb: "Move working capital to an address the applicant allowlisted at issuance.",
    contract: "LetterOfCredit",
    fn: "payTo",
    role: "agent",
    fields: [
      { name: "letterId", label: "Credit", type: "uint" },
      { name: "recipient", label: "Recipient", type: "address" },
      { name: "amount", label: "Amount", type: "ether", placeholder: "0.1" },
    ],
  },
  {
    id: "execute",
    label: "Call a named contract",
    blurb:
      "Call an allowlisted contract with an allowlisted method. Both the target and the 4-byte selector must be in the mandate.",
    contract: "LetterOfCredit",
    fn: "execute",
    role: "agent",
    fields: [
      { name: "letterId", label: "Credit", type: "uint" },
      { name: "target", label: "Target contract", type: "address" },
      { name: "value", label: "Value", type: "ether", placeholder: "0.1" },
      {
        name: "data",
        label: "Calldata",
        type: "hex",
        placeholder: "0x02333318…",
        help: "Selector plus arguments. The demo supplier's method is invoice(bytes32) = 0x02333318.",
      },
    ],
  },
  {
    id: "presentDocuments",
    label: "Present documents",
    blurb:
      "Put the job's evidence on-chain and stop acting. The body is emitted in full, and the contract rejects any body that does not hash to the committed hash.",
    contract: "LetterOfCredit",
    fn: "presentDocuments",
    role: "agent",
    fields: [
      { name: "letterId", label: "Credit", type: "uint" },
      { name: "documentURI", label: "Document URI", type: "string", optional: true },
      {
        name: "documents",
        label: "Documents",
        type: "json",
        help: "The hash is computed from exactly these bytes, in your browser, before it is sent.",
      },
    ],
  },

  // --- examination ---------------------------------------------------------
  {
    id: "validationRequest",
    label: "Request examination",
    blurb:
      "Ask the named examiner to attest a document hash. ERC-8004 requires this to come from the agent's owner or an approved operator.",
    contract: "ValidationRegistry",
    fn: "validationRequest",
    role: "principal",
    fields: [
      { name: "validatorAddress", label: "Examiner", type: "address" },
      { name: "agentId", label: "Agent id", type: "uint" },
      { name: "requestURI", label: "Request URI", type: "string", optional: true },
      { name: "requestHash", label: "Document hash", type: "bytes32" },
    ],
  },
  {
    id: "validationResponse",
    label: "Answer the examination",
    blurb:
      "The examiner scores the presented hash from 0 to 100. This is what the credit reads at settlement. Below the threshold, the fee is simply not payable.",
    contract: "ValidationRegistry",
    fn: "validationResponse",
    role: "validator",
    tone: "verd",
    fields: [
      { name: "requestHash", label: "Document hash", type: "bytes32" },
      { name: "response", label: "Score (0–100)", type: "uint8", placeholder: "100" },
      { name: "responseURI", label: "Response URI", type: "string", optional: true },
      { name: "responseHash", label: "Response hash", type: "bytes32", optional: true },
      { name: "tag", label: "Tag", type: "string", optional: true },
    ],
  },

  // --- settlement ----------------------------------------------------------
  {
    id: "draw",
    label: "Draw the credit",
    blurb:
      "Release the fee to the credit holder and return unspent capital to the applicant. Permissionless: every condition is on-chain, so any address may settle.",
    contract: "LetterOfCredit",
    fn: "draw",
    role: "anyone",
    tone: "verd",
    fields: [{ name: "letterId", label: "Credit", type: "uint" }],
  },
  {
    id: "dispute",
    label: "Dispute the presentation",
    blurb: "The applicant objects, inside the dispute window. Blocks settlement until the examiner rules.",
    contract: "LetterOfCredit",
    fn: "dispute",
    role: "applicant",
    fields: [
      { name: "letterId", label: "Credit", type: "uint" },
      { name: "reasonURI", label: "Reason URI", type: "string", optional: true },
    ],
  },
  {
    id: "resolveDispute",
    label: "Resolve the dispute",
    blurb:
      "The named examiner rules. Only the fee is at stake, capital already paid to a named destination is gone by construction.",
    contract: "LetterOfCredit",
    fn: "resolveDispute",
    role: "validator",
    fields: [
      { name: "letterId", label: "Credit", type: "uint" },
      { name: "favourBeneficiary", label: "Rule for the agent?", type: "bool" },
      { name: "resolutionURI", label: "Resolution URI", type: "string", optional: true },
    ],
  },
  {
    id: "refundExpired",
    label: "Refund after expiry",
    blurb: "Once the credit has expired, whatever was not spent returns to the applicant.",
    contract: "LetterOfCredit",
    fn: "refundExpired",
    role: "anyone",
    fields: [{ name: "letterId", label: "Credit", type: "uint" }],
  },
  {
    id: "cancel",
    label: "Cancel an untouched credit",
    blurb: "The applicant withdraws, allowed only while nothing has been spent.",
    contract: "LetterOfCredit",
    fn: "cancel",
    role: "applicant",
    fields: [{ name: "letterId", label: "Credit", type: "uint" }],
  },

  // --- identity ------------------------------------------------------------
  {
    id: "register",
    label: "Register an agent",
    blurb:
      "Mint an ERC-8004 agent identity. The registering address becomes both the owner and the initially bound acting wallet.",
    contract: "IdentityRegistry",
    fn: "register",
    role: "anyone",
    fields: [
      {
        name: "agentURI",
        label: "Registration file URI",
        type: "string",
        help: "An ERC-8004 registration file. A data: URI keeps the agent card self-describing on-chain.",
      },
    ],
  },
];

export const actionById = (id: string) => ACTIONS.find((a) => a.id === id);

/** Shared by the browser and the server so both encode arguments identically. */
export function parseArgs(action: ActionDef, values: Record<string, string>): unknown[] {
  return action.fields.map((f) => {
    const raw = (values[f.name] ?? "").trim();

    if (!raw && f.optional) {
      if (f.type === "bytes32") return `0x${"0".repeat(64)}` as Hex;
      if (f.type === "bool") return false;
      return "";
    }
    if (!raw && !f.optional) throw new Error(`${f.label} is required`);

    switch (f.type) {
      case "ether":
        return parseEther(raw);
      case "uint":
      case "uint8":
        return BigInt(raw);
      case "bool":
        return raw === "true" || raw === "on" || raw === "1";
      case "address":
        if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) throw new Error(`${f.label} is not an address`);
        return raw as Hex;
      case "bytes32":
        if (!/^0x[a-fA-F0-9]{64}$/.test(raw)) throw new Error(`${f.label} must be a 32-byte hash`);
        return raw as Hex;
      case "hex":
        if (!/^0x[a-fA-F0-9]*$/.test(raw)) throw new Error(`${f.label} must be hex`);
        return raw as Hex;
      case "json":
        // The document body travels as text and is hashed from its exact bytes.
        return stringToHex(raw);
      default:
        return raw;
    }
  });
}

// The hash is derived from the body here, so the two can never be entered inconsistently.
export function finaliseArgs(action: ActionDef, args: unknown[]): unknown[] {
  if (action.fn !== "presentDocuments") return args;
  const [letterId, documentURI, documents] = args as [bigint, string, Hex];
  return [letterId, documentURI, keccak256(documents), documents];
}

export function valueOf(action: ActionDef, values: Record<string, string>): bigint {
  if (!action.valueField) {
    // `issue` is handled by its own form; `execute` funds the call from the credit.
    return 0n;
  }
  const raw = (values[action.valueField] ?? "0").trim();
  return raw ? parseEther(raw) : 0n;
}

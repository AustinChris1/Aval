import assert from "node:assert/strict";
import { describe, it, before, beforeEach } from "node:test";
import { network } from "hardhat";
import {
  parseEther,
  keccak256,
  stringToHex,
  encodeFunctionData,
  toFunctionSelector,
  type Address,
  type WalletClient,
} from "viem";

// AVAL test suite: proves an agent cannot spend outside its mandate nor be paid unexamined, against real reverts.

const ONE_HOUR = 3600n;
/** toFunctionSelector("invoice(bytes32)"), computed, not guessed. */
const INVOICE_SELECTOR = toFunctionSelector("invoice(bytes32)");

/** Address equality that ignores EIP-55 checksum casing. */
function eqAddr(a: string, b: string, msg?: string) {
  assert.equal(a.toLowerCase(), b.toLowerCase(), msg);
}

/** Asserts `p` reverts and that viem decoded the given custom error name. */
async function expectRevert(p: Promise<unknown>, name: string) {
  try {
    await p;
  } catch (e: unknown) {
    const err = e as { message?: string; shortMessage?: string; metaMessages?: string[] };
    const text = [err.shortMessage, err.message, ...(err.metaMessages ?? [])]
      .filter(Boolean)
      .join(" | ");
    assert.ok(text.includes(name), `expected revert "${name}" but got: ${text}`);
    return;
  }
  assert.fail(`expected revert "${name}" but the call succeeded`);
}

describe("AVAL, documentary credit for agents", async () => {
  const { viem, networkHelpers } = await network.connect();

  let deployer: WalletClient;
  let applicant: WalletClient;
  let principal: WalletClient; // owns the agent NFT
  let agentKey: WalletClient; // the bound agentWallet: acts, holds nothing
  let validator: WalletClient; // the named examiner
  let vendorPayee: WalletClient; // an allowlisted supplier EOA
  let stranger: WalletClient; // an address the mandate does not name

  let identity: any;
  let reputation: any;
  let validationReg: any;
  let letter: any;
  let vendor: any;

  let agentId: bigint;
  let publicClient: any;

  const addr = (w: WalletClient) => w.account!.address as Address;

  before(async () => {
    [deployer, applicant, principal, agentKey, validator, vendorPayee, stranger] =
      await viem.getWalletClients();
    publicClient = await viem.getPublicClient();
  });

  beforeEach(async () => {
    identity = await viem.deployContract("IdentityRegistry");
    reputation = await viem.deployContract("ReputationRegistry", [identity.address]);
    validationReg = await viem.deployContract("ValidationRegistry", [identity.address]);
    letter = await viem.deployContract("LetterOfCredit", [
      identity.address,
      reputation.address,
      validationReg.address,
    ]);
    vendor = await viem.deployContract("ServiceVendor", [addr(vendorPayee)]);

    // The principal registers the agent, then binds a separate acting key.
    const idAsPrincipal = await viem.getContractAt("IdentityRegistry", identity.address, {
      client: { wallet: principal },
    });
    await idAsPrincipal.write.register(["https://letter.example/agent/treasury-ops.json"]);
    agentId = (await identity.read.totalRegistered()) - 1n;

    await bindAgentWallet(agentId, principal, agentKey);
  });

  /** Binds `wallet` as the agent's acting key using the EIP-712 flow in the spec. */
  async function bindAgentWallet(id: bigint, owner: WalletClient, wallet: WalletClient) {
    const block = await publicClient.getBlock();
    const deadline = block.timestamp + 120n;
    const chainId = await publicClient.getChainId();

    const signature = await wallet.signTypedData({
      account: wallet.account!,
      domain: {
        name: "ERC8004IdentityRegistry",
        version: "1",
        chainId,
        verifyingContract: identity.address as Address,
      },
      types: {
        AgentWalletSet: [
          { name: "agentId", type: "uint256" },
          { name: "newWallet", type: "address" },
          { name: "owner", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      },
      primaryType: "AgentWalletSet",
      message: {
        agentId: id,
        newWallet: addr(wallet),
        owner: addr(owner),
        deadline,
      },
    });

    const asOwner = await viem.getContractAt("IdentityRegistry", identity.address, {
      client: { wallet: owner },
    });
    await asOwner.write.setAgentWallet([id, addr(wallet), deadline, signature]);
  }

  /** Issues a native-BOT letter with a mandate naming the vendor EOA and contract. */
  async function issueLetter(
    overrides: Partial<{
      faceValue: bigint;
      fee: bigint;
      maxPerCall: bigint;
      expirySecs: bigint;
      disputeWindow: bigint;
      minScore: number;
      recipients: Address[];
      targets: Address[];
      selectors: `0x${string}`[];
      asset: Address;
    }> = {},
  ) {
    const block = await publicClient.getBlock();
    const faceValue = overrides.faceValue ?? parseEther("10");
    const fee = overrides.fee ?? parseEther("1");
    const asset = overrides.asset ?? ("0x0000000000000000000000000000000000000000" as Address);

    const params = {
      agentId,
      asset,
      faceValue,
      fee,
      maxPerCall: overrides.maxPerCall ?? parseEther("4"),
      expiry: block.timestamp + (overrides.expirySecs ?? ONE_HOUR),
      disputeWindow: overrides.disputeWindow ?? 0n,
      validator: addr(validator),
      minScore: overrides.minScore ?? 70,
      termsHash: keccak256(stringToHex("terms-v1")),
      termsURI: "https://letter.example/terms/1.json",
      allowedRecipients: overrides.recipients ?? [addr(vendorPayee)],
      allowedTargets: overrides.targets ?? [vendor.address as Address],
      allowedSelectors: overrides.selectors ?? [INVOICE_SELECTOR], // invoice(bytes32)
    };

    const asApplicant = await viem.getContractAt("LetterOfCredit", letter.address, {
      client: { wallet: applicant },
    });
    await asApplicant.write.issue([params], {
      value: asset === "0x0000000000000000000000000000000000000000" ? faceValue : 0n,
    });
    return await letter.read.totalLetters();
  }

  const asAgent = async () =>
    viem.getContractAt("LetterOfCredit", letter.address, { client: { wallet: agentKey } });
  const asApplicant = async () =>
    viem.getContractAt("LetterOfCredit", letter.address, { client: { wallet: applicant } });
  const asValidator = async () =>
    viem.getContractAt("ValidationRegistry", validationReg.address, {
      client: { wallet: validator },
    });

  // --- identity ------------------------------------------------------------

  describe("ERC-8004 identity", () => {
    it("registers an agent as an ERC-721 and binds a separate acting key", async () => {
      eqAddr(await identity.read.ownerOf([agentId]), addr(principal));
      eqAddr(await identity.read.getAgentWallet([agentId]), addr(agentKey));
      assert.equal(await identity.read.name(), "AgentIdentity");
    });

    it("clears the bound wallet when the agent is sold", async () => {
      const asPrincipal = await viem.getContractAt("IdentityRegistry", identity.address, {
        client: { wallet: principal },
      });
      await asPrincipal.write.transferFrom([addr(principal), addr(stranger), agentId]);
      eqAddr(
        await identity.read.getAgentWallet([agentId]),
        "0x0000000000000000000000000000000000000000",
      );
    });

    it("rejects a wallet binding that the wallet itself did not sign", async () => {
      const block = await publicClient.getBlock();
      const asPrincipal = await viem.getContractAt("IdentityRegistry", identity.address, {
        client: { wallet: principal },
      });
      await assert.rejects(
        asPrincipal.write.setAgentWallet([agentId, addr(stranger), block.timestamp + 60n, "0x00"]),
      );
    });
  });

  // --- issuance ------------------------------------------------------------

  describe("issuance", () => {
    it("locks the face value and mints the credit to the beneficiary", async () => {
      const id = await issueLetter();
      const L = await letter.read.getLetter([id]);

      eqAddr(L.applicant, addr(applicant));
      assert.equal(L.faceValue, parseEther("10"));
      assert.equal(L.fee, parseEther("1"));
      assert.equal(L.status, 1); // Open
      assert.equal(
        await publicClient.getBalance({ address: letter.address }),
        parseEther("10"),
      );
      // The beneficiary (the agent's owner) holds the credit and may assign it.
      eqAddr(await letter.read.ownerOf([id]), addr(principal));
      // The fee is reserved: it is not working capital.
      assert.equal(await letter.read.available([id]), parseEther("9"));
    });

    it("refuses to issue against an agent with no bound wallet", async () => {
      const asPrincipal = await viem.getContractAt("IdentityRegistry", identity.address, {
        client: { wallet: principal },
      });
      await asPrincipal.write.unsetAgentWallet([agentId]);
      await expectRevert(issueLetter(), "AgentWalletUnset");
    });

    it("rejects a threshold of zero, which no examination could fail", async () => {
      await expectRevert(issueLetter({ minScore: 0 }), "BadParams");
    });
  });

  // --- the mandate: the product's core claim -------------------------------

  describe("mandate enforcement", () => {
    it("pays a named supplier out of working capital", async () => {
      const id = await issueLetter();
      const before = await publicClient.getBalance({ address: addr(vendorPayee) });

      const agent = await asAgent();
      await agent.write.payTo([id, addr(vendorPayee), parseEther("3")]);

      const after = await publicClient.getBalance({ address: addr(vendorPayee) });
      assert.equal(after - before, parseEther("3"));
      assert.equal(await letter.read.available([id]), parseEther("6"));
    });

    it("blocks payment to an address the mandate does not name", async () => {
      const id = await issueLetter();
      const agent = await asAgent();
      await expectRevert(
        agent.write.payTo([id, addr(stranger), parseEther("3")]),
        "RecipientNotAllowed",
      );
      // Nothing moved.
      assert.equal(await letter.read.available([id]), parseEther("9"));
      assert.equal(
        await publicClient.getBalance({ address: letter.address }),
        parseEther("10"),
      );
    });

    it("blocks a payment larger than the per-call cap", async () => {
      const id = await issueLetter({ maxPerCall: parseEther("2") });
      const agent = await asAgent();
      await expectRevert(
        agent.write.payTo([id, addr(vendorPayee), parseEther("3")]),
        "ExceedsPerCallCap",
      );
    });

    it("cannot spend into the reserved fee", async () => {
      const id = await issueLetter({ maxPerCall: parseEther("10") });
      const agent = await asAgent();
      // 9 BOT of working capital; the 10th is the reserved fee.
      await expectRevert(
        agent.write.payTo([id, addr(vendorPayee), parseEther("10")]),
        "InsufficientCredit",
      );
      await agent.write.payTo([id, addr(vendorPayee), parseEther("9")]);
      await expectRevert(agent.write.payTo([id, addr(vendorPayee), 1n]), "InsufficientCredit");
    });

    it("calls a named contract with a named selector", async () => {
      const id = await issueLetter();
      const agent = await asAgent();
      const ref = keccak256(stringToHex("invoice-001"));
      const data = encodeFunctionData({
        abi: vendor.abi,
        functionName: "invoice",
        args: [ref],
      });

      await agent.write.execute([id, vendor.address, parseEther("2"), data]);

      assert.equal(await vendor.read.totalReceived(), parseEther("2"));
      const inv = await vendor.read.invoices([ref]);
      eqAddr(inv[0], letter.address); // the letter paid, not the agent
      assert.equal(inv[1], parseEther("2"));
    });

    it("blocks a call to a contract the mandate does not name", async () => {
      const id = await issueLetter();
      const rogue = await viem.deployContract("ServiceVendor", [addr(stranger)]);
      const agent = await asAgent();
      const data = encodeFunctionData({
        abi: vendor.abi,
        functionName: "invoice",
        args: [keccak256(stringToHex("x"))],
      });
      await expectRevert(
        agent.write.execute([id, rogue.address, parseEther("1"), data]),
        "TargetNotAllowed",
      );
    });

    it("blocks a selector the mandate does not name, on an allowed contract", async () => {
      const id = await issueLetter();
      const agent = await asAgent();
      const data = encodeFunctionData({
        abi: vendor.abi,
        functionName: "withdraw",
        args: [addr(stranger)],
      });
      await expectRevert(agent.write.execute([id, vendor.address, 0n, data]), "SelectorNotAllowed");
    });

    it("blocks a plain value transfer when only a selector was allowlisted", async () => {
      const id = await issueLetter();
      const agent = await asAgent();
      await expectRevert(
        agent.write.execute([id, vendor.address, parseEther("1"), "0x"]),
        "SelectorNotAllowed",
      );
    });

    it("refuses anyone who is not the agent's bound wallet", async () => {
      const id = await issueLetter();
      const asPrincipal = await viem.getContractAt("LetterOfCredit", letter.address, {
        client: { wallet: principal },
      });
      // Even the agent's own owner cannot move the money.
      await expectRevert(
        asPrincipal.write.payTo([id, addr(vendorPayee), parseEther("1")]),
        "NotAgentWallet",
      );
    });

    it("stops the agent once the letter has expired", async () => {
      const id = await issueLetter({ expirySecs: 60n });
      await networkHelpers.time.increase(120);
      const agent = await asAgent();
      await expectRevert(
        agent.write.payTo([id, addr(vendorPayee), parseEther("1")]),
        "LetterExpired",
      );
    });
  });

  // --- presentation, examination, settlement -------------------------------

  describe("payment against documents", () => {
    const docs = stringToHex(
      JSON.stringify({ job: "pay supplier invoice-001", result: "settled", amount: "2" }),
    );
    const docHash = keccak256(docs);

    async function present(id: bigint) {
      const agent = await asAgent();
      await agent.write.presentDocuments([
        id,
        "https://letter.example/docs/1.json",
        docHash,
        docs,
      ]);
    }

    /** The agent asks the named examiner to attest the document hash. */
    async function requestExam(id: bigint) {
      const asPrincipal = await viem.getContractAt("ValidationRegistry", validationReg.address, {
        client: { wallet: principal },
      });
      await asPrincipal.write.validationRequest([
        addr(validator),
        agentId,
        "https://letter.example/docs/1.json",
        docHash,
      ]);
    }

    it("refuses a document body that does not hash to the committed hash", async () => {
      const id = await issueLetter();
      const agent = await asAgent();
      const lie = stringToHex(JSON.stringify({ job: "something else entirely" }));
      // Committing to docHash while emitting different bytes would gut the evidence, so the credit rejects it.
      await expectRevert(
        agent.write.presentDocuments([id, "https://letter.example/docs/1.json", docHash, lie]),
        "DocumentHashMismatch",
      );
    });

    it("allows a hash-only presentation with the body held off-chain", async () => {
      const id = await issueLetter();
      const agent = await asAgent();
      await agent.write.presentDocuments([id, "https://letter.example/docs/1.json", docHash, "0x"]);
      assert.equal((await letter.read.getLetter([id])).docHash, docHash);
    });

    it("will not pay before the documents have been examined", async () => {
      const id = await issueLetter();
      await present(id);
      await expectRevert((await asAgent()).write.draw([id]), "DocumentsNotExamined");
    });

    it("will not pay on an examination below the threshold", async () => {
      const id = await issueLetter({ minScore: 70 });
      await present(id);
      await requestExam(id);
      await (await asValidator()).write.validationResponse([
        docHash,
        40,
        "https://letter.example/exam/1.json",
        docHash,
        "letter",
      ]);
      await expectRevert((await asAgent()).write.draw([id]), "ScoreBelowThreshold");
    });

    it("pays the fee to the credit holder and returns the remainder", async () => {
      const id = await issueLetter();
      const agent = await asAgent();
      await agent.write.payTo([id, addr(vendorPayee), parseEther("3")]);
      await present(id);
      await requestExam(id);
      await (await asValidator()).write.validationResponse([
        docHash,
        95,
        "https://letter.example/exam/1.json",
        docHash,
        "letter",
      ]);

      const holderBefore = await publicClient.getBalance({ address: addr(principal) });
      const applicantBefore = await publicClient.getBalance({ address: addr(applicant) });

      // Permissionless: every condition is on-chain, so anyone may settle.
      const asStranger = await viem.getContractAt("LetterOfCredit", letter.address, {
        client: { wallet: stranger },
      });
      await asStranger.write.draw([id]);

      const holderAfter = await publicClient.getBalance({ address: addr(principal) });
      const applicantAfter = await publicClient.getBalance({ address: addr(applicant) });

      assert.equal(holderAfter - holderBefore, parseEther("1")); // the fee
      assert.equal(applicantAfter - applicantBefore, parseEther("6")); // unspent capital
      assert.equal((await letter.read.getLetter([id])).status, 4); // Settled
      assert.equal(await publicClient.getBalance({ address: letter.address }), 0n);
    });

    it("writes payment-backed reputation that only a settled letter can produce", async () => {
      const id = await issueLetter();
      await present(id);
      await requestExam(id);
      await (await asValidator()).write.validationResponse([docHash, 88, "", docHash, "letter"]);
      await (await asAgent()).write.draw([id]);

      const [count, value] = await reputation.read.getSummary([
        agentId,
        [letter.address],
        "letter.settled",
        "",
      ]);
      assert.equal(count, 1n);
      assert.equal(value, 88n);
    });

    it("pays a new holder after the credit is assigned", async () => {
      const id = await issueLetter();
      await present(id);
      await requestExam(id);
      await (await asValidator()).write.validationResponse([docHash, 90, "", docHash, "letter"]);

      // The beneficiary sells the credit; proceeds follow the token.
      const holder = await viem.getContractAt("LetterOfCredit", letter.address, {
        client: { wallet: principal },
      });
      await holder.write.transferFrom([addr(principal), addr(stranger), id]);

      const before = await publicClient.getBalance({ address: addr(stranger) });
      await (await asAgent()).write.draw([id]);
      const after = await publicClient.getBalance({ address: addr(stranger) });
      assert.equal(after - before, parseEther("1"));
    });

    it("honours the dispute window before allowing a draw", async () => {
      const id = await issueLetter({ disputeWindow: 600n });
      await present(id);
      await requestExam(id);
      await (await asValidator()).write.validationResponse([docHash, 99, "", docHash, "letter"]);
      await expectRevert((await asAgent()).write.draw([id]), "DisputeWindowOpen");

      await networkHelpers.time.increase(700);
      await (await asAgent()).write.draw([id]);
      assert.equal((await letter.read.getLetter([id])).status, 4);
    });

    it("returns everything to the applicant when a dispute is upheld", async () => {
      const id = await issueLetter({ disputeWindow: 600n });
      const agent = await asAgent();
      await agent.write.payTo([id, addr(vendorPayee), parseEther("2")]);
      await present(id);

      await (await asApplicant()).write.dispute([id, "https://letter.example/dispute/1.json"]);
      assert.equal((await letter.read.getLetter([id])).status, 3); // Disputed

      const before = await publicClient.getBalance({ address: addr(applicant) });
      const validatorLetter = await viem.getContractAt("LetterOfCredit", letter.address, {
        client: { wallet: validator },
      });
      await validatorLetter.write.resolveDispute([id, false, "https://letter.example/res/1.json"]);
      const after = await publicClient.getBalance({ address: addr(applicant) });

      // The fee is withheld and unspent capital returns; the 2 BOT paid to the supplier is gone by construction.
      assert.equal(after - before, parseEther("8"));
      assert.equal((await letter.read.getLetter([id])).status, 5); // Refunded
    });

    it("lets only the named examiner resolve a dispute", async () => {
      const id = await issueLetter({ disputeWindow: 600n });
      await present(id);
      await (await asApplicant()).write.dispute([id, "x"]);
      const asStranger = await viem.getContractAt("LetterOfCredit", letter.address, {
        client: { wallet: stranger },
      });
      await expectRevert(asStranger.write.resolveDispute([id, true, "x"]), "NotValidator");
    });
  });

  // --- expiry and withdrawal ----------------------------------------------

  describe("expiry and withdrawal", () => {
    it("returns unspent funds to the applicant after expiry", async () => {
      const id = await issueLetter({ expirySecs: 60n });
      const agent = await asAgent();
      await agent.write.payTo([id, addr(vendorPayee), parseEther("4")]);
      await networkHelpers.time.increase(120);

      const before = await publicClient.getBalance({ address: addr(applicant) });
      await (await asAgent()).write.refundExpired([id]);
      const after = await publicClient.getBalance({ address: addr(applicant) });
      assert.equal(after - before, parseEther("6"));
    });

    it("will not refund before expiry", async () => {
      const id = await issueLetter();
      await expectRevert((await asAgent()).write.refundExpired([id]), "NotYetExpired");
    });

    it("lets the applicant cancel an untouched letter", async () => {
      const id = await issueLetter();
      const before = await publicClient.getBalance({ address: addr(applicant) });
      await (await asApplicant()).write.cancel([id]);
      const after = await publicClient.getBalance({ address: addr(applicant) });
      assert.ok(after > before);
      assert.equal((await letter.read.getLetter([id])).status, 6); // Cancelled
    });

    it("refuses to cancel once the agent has spent", async () => {
      const id = await issueLetter();
      await (await asAgent()).write.payTo([id, addr(vendorPayee), parseEther("1")]);
      await expectRevert((await asApplicant()).write.cancel([id]), "BadParams");
    });
  });

  // --- stablecoin letters --------------------------------------------------

  describe("ERC-20 denominated letters", () => {
    it("issues, pays and settles in a stablecoin", async () => {
      const usdt = await viem.deployContract("MockERC20", ["Tether USD", "USDT", 18]);
      await usdt.write.mint([addr(applicant), parseEther("1000")]);

      const asApp = await viem.getContractAt("MockERC20", usdt.address, {
        client: { wallet: applicant },
      });
      await asApp.write.approve([letter.address, parseEther("1000")]);

      const id = await issueLetter({ asset: usdt.address as Address });
      assert.equal(await usdt.read.balanceOf([letter.address]), parseEther("10"));

      const agent = await asAgent();
      await agent.write.payTo([id, addr(vendorPayee), parseEther("3")]);
      assert.equal(await usdt.read.balanceOf([addr(vendorPayee)]), parseEther("3"));

      // Value-bearing calls make no sense for a token letter.
      await expectRevert(
        agent.write.execute([id, vendor.address, parseEther("1"), "0x"]),
        "ValueNotAllowedForERC20Letter",
      );
    });
  });
});

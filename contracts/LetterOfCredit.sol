// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IIdentityRegistry, IReputationRegistry, IValidationRegistry} from "./interfaces/IERC8004.sol";

/**
 * @title LetterOfCredit — documentary credit for autonomous agents
 * @author LETTER (BOT Chain Builder Challenge #2)
 *
 * @notice A letter of credit is the oldest instrument in commerce: a payer locks
 *         funds with a bank, and the beneficiary is paid only against documents
 *         that comply with terms agreed up front. LETTER applies that instrument
 *         to the first economic actors that cannot be sued — software with wallets.
 *
 *         An applicant locks value against a named job, a named ERC-8004 agent, a
 *         mandate, and a named examiner. Three properties follow:
 *
 *         1. The agent never custodies the money. This contract does. The agent
 *            submits intents; they execute only if the mandate permits them. A
 *            disallowed payment does not become a loss the applicant has to chase
 *            afterwards — it reverts.
 *         2. Payment is against documents. The fee is releasable only once the
 *            examiner named at issuance has scored the exact document hash the
 *            agent presented, at or above the threshold written into the letter.
 *         3. The letter is itself a claim. It is an ERC-721 token: whoever holds
 *            it receives the proceeds, so a credit can be assigned or sold the way
 *            real documentary credits are.
 *
 * @dev Design notes worth knowing before reading:
 *
 *      - `faceValue` splits into working capital and `fee`. Working capital is
 *        what the agent may move under the mandate; `fee` is reserved and cannot
 *        be spent, only drawn on compliant presentation. Unspent working capital
 *        always returns to the applicant.
 *      - The acting key is resolved from the Identity Registry on every call
 *        rather than pinned at issuance, which is what ERC-8004 means by
 *        `agentWallet`: a principal may legitimately rotate its agent's key. The
 *        applicant is protected by the mandate, not by key immutability. The
 *        wallet in force at issuance is recorded in `LetterIssued` for audit.
 *      - Every rejection is a custom error, so a blocked attempt is a permanent,
 *        decodable on-chain artifact rather than a log line someone has to trust.
 *      - This contract writes reputation as the ERC-8004 *client*. It can only do
 *        so for a letter that actually settled, which makes the resulting score
 *        payment-backed instead of self-asserted. Feedback is wrapped in
 *        try/catch: a registry that reverts must never be able to strand funds.
 */
contract LetterOfCredit is ERC721, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Sentinel asset address meaning the chain's native coin (BOT).
    address public constant NATIVE = address(0);

    enum Status {
        None,
        Open, // issued; agent may act under the mandate
        Presented, // documents on-chain; awaiting examination / draw
        Disputed, // applicant objected inside the dispute window
        Settled, // fee paid to the holder, remainder returned
        Refunded, // expired or resolved against the beneficiary
        Cancelled // withdrawn by the applicant before any spend
    }

    struct Letter {
        address applicant;
        address asset; // NATIVE or an ERC-20
        address validator; // the examiner named at issuance
        uint256 agentId; // ERC-8004 beneficiary
        uint256 faceValue; // working capital + fee
        uint256 fee; // reserved; drawn only on compliant presentation
        uint256 spent; // working capital already moved
        uint64 expiry;
        uint64 disputeWindow; // seconds after presentation before a draw is allowed
        uint64 presentedAt;
        uint8 minScore; // required examiner score, 0..100
        Status status;
        bytes32 termsHash; // hash of the off-chain terms
        bytes32 docHash; // hash of the presented documents
    }

    struct IssueParams {
        uint256 agentId;
        address asset;
        uint256 faceValue;
        uint256 fee;
        uint256 maxPerCall;
        uint64 expiry;
        uint64 disputeWindow;
        address validator;
        uint8 minScore;
        bytes32 termsHash;
        string termsURI;
        address[] allowedRecipients; // payTo destinations
        address[] allowedTargets; // execute destinations
        bytes4[] allowedSelectors; // execute selectors (0x00000000 = plain value call)
    }

    IIdentityRegistry public immutable identity;
    IReputationRegistry public immutable reputation;
    IValidationRegistry public immutable validation;

    uint256 private _nextId = 1;

    mapping(uint256 => Letter) private _letters;
    mapping(uint256 => uint256) private _maxPerCall;
    mapping(uint256 => string) private _docURI;

    mapping(uint256 => mapping(address => bool)) private _allowedRecipient;
    mapping(uint256 => mapping(address => bool)) private _allowedTarget;
    mapping(uint256 => mapping(bytes4 => bool)) private _allowedSelector;
    mapping(uint256 => address[]) private _recipientList;
    mapping(uint256 => address[]) private _targetList;
    mapping(uint256 => bytes4[]) private _selectorList;

    // --- events -------------------------------------------------------------

    event LetterIssued(
        uint256 indexed letterId,
        address indexed applicant,
        uint256 indexed agentId,
        address agentWalletAtIssuance,
        address asset,
        uint256 faceValue,
        uint256 fee,
        uint256 maxPerCall,
        uint64 expiry,
        address validator,
        uint8 minScore,
        bytes32 termsHash,
        string termsURI
    );
    event MandateEntry(uint256 indexed letterId, uint8 kind, bytes32 value); // 0=recipient 1=target 2=selector
    event Paid(uint256 indexed letterId, address indexed recipient, uint256 amount, uint256 spentTotal);
    event Executed(
        uint256 indexed letterId, address indexed target, bytes4 indexed selector, uint256 value, uint256 spentTotal
    );
    event DocumentsPresented(
        uint256 indexed letterId, uint256 indexed agentId, bytes32 indexed docHash, string docURI, bytes documents
    );
    event Drawn(uint256 indexed letterId, address indexed payee, uint256 fee, uint256 returned, uint8 score);
    event Disputed(uint256 indexed letterId, address indexed applicant, string reasonURI);
    event DisputeResolved(uint256 indexed letterId, bool favourBeneficiary, string resolutionURI);
    event Refunded(uint256 indexed letterId, address indexed applicant, uint256 amount, Status status);
    event FeedbackFailed(uint256 indexed letterId, uint256 indexed agentId);

    // --- errors -------------------------------------------------------------

    error BadStatus(Status found, Status required);
    error NotApplicant();
    error NotAgentWallet(address caller, address expected);
    error NotValidator(address caller, address expected);
    error AgentWalletUnset(uint256 agentId);
    error LetterExpired(uint64 expiry, uint256 now_);
    error NotYetExpired(uint64 expiry);
    error RecipientNotAllowed(address recipient);
    error TargetNotAllowed(address target);
    error SelectorNotAllowed(bytes4 selector);
    error ExceedsPerCallCap(uint256 amount, uint256 cap);
    error InsufficientCredit(uint256 amount, uint256 available);
    error ValueNotAllowedForERC20Letter();
    error BadParams(string what);
    error DocumentsNotExamined(bytes32 docHash);
    error DocumentHashMismatch(bytes32 computed, bytes32 committed);
    error ScoreBelowThreshold(uint8 score, uint8 required);
    error WrongValidationSubject();
    error DisputeWindowOpen(uint64 until);
    error DisputeWindowClosed(uint64 until);
    error CallFailed(bytes returndata);

    constructor(address identity_, address reputation_, address validation_)
        ERC721("LETTER Documentary Credit", "LOC")
    {
        if (identity_ == address(0) || reputation_ == address(0) || validation_ == address(0)) {
            revert BadParams("registry");
        }
        identity = IIdentityRegistry(identity_);
        reputation = IReputationRegistry(reputation_);
        validation = IValidationRegistry(validation_);
    }

    // --- issuance -----------------------------------------------------------

    /**
     * @notice Lock funds against a job, an agent, a mandate and an examiner.
     * @dev The letter token is minted to the agent's ERC-721 owner: the
     *      beneficiary holds the credit and may assign it by transfer.
     */
    function issue(IssueParams calldata p) external payable nonReentrant returns (uint256 letterId) {
        if (p.faceValue == 0) revert BadParams("faceValue");
        if (p.fee > p.faceValue) revert BadParams("fee");
        if (p.expiry <= block.timestamp) revert BadParams("expiry");
        if (p.validator == address(0)) revert BadParams("validator");
        // minScore >= 1: see _requireExamined — a pending examination reads as 0.
        if (p.minScore == 0 || p.minScore > 100) revert BadParams("minScore");
        if (p.maxPerCall == 0) revert BadParams("maxPerCall");

        // Reverts if the agent does not exist.
        address beneficiary = identity.ownerOf(p.agentId);
        address agentWallet = identity.getAgentWallet(p.agentId);
        if (agentWallet == address(0)) revert AgentWalletUnset(p.agentId);

        if (p.asset == NATIVE) {
            if (msg.value != p.faceValue) revert BadParams("msg.value");
        } else {
            if (msg.value != 0) revert BadParams("msg.value");
            IERC20(p.asset).safeTransferFrom(msg.sender, address(this), p.faceValue);
        }

        letterId = _nextId++;
        _letters[letterId] = Letter({
            applicant: msg.sender,
            asset: p.asset,
            validator: p.validator,
            agentId: p.agentId,
            faceValue: p.faceValue,
            fee: p.fee,
            spent: 0,
            expiry: p.expiry,
            disputeWindow: p.disputeWindow,
            presentedAt: 0,
            minScore: p.minScore,
            status: Status.Open,
            termsHash: p.termsHash,
            docHash: bytes32(0)
        });
        _maxPerCall[letterId] = p.maxPerCall;

        for (uint256 i; i < p.allowedRecipients.length; i++) {
            address r = p.allowedRecipients[i];
            if (!_allowedRecipient[letterId][r]) {
                _allowedRecipient[letterId][r] = true;
                _recipientList[letterId].push(r);
                emit MandateEntry(letterId, 0, bytes32(uint256(uint160(r))));
            }
        }
        for (uint256 i; i < p.allowedTargets.length; i++) {
            address t = p.allowedTargets[i];
            if (!_allowedTarget[letterId][t]) {
                _allowedTarget[letterId][t] = true;
                _targetList[letterId].push(t);
                emit MandateEntry(letterId, 1, bytes32(uint256(uint160(t))));
            }
        }
        for (uint256 i; i < p.allowedSelectors.length; i++) {
            bytes4 s = p.allowedSelectors[i];
            if (!_allowedSelector[letterId][s]) {
                _allowedSelector[letterId][s] = true;
                _selectorList[letterId].push(s);
                emit MandateEntry(letterId, 2, bytes32(s));
            }
        }

        // _mint, not _safeMint: issuance must not hand control to a receiver hook.
        _mint(beneficiary, letterId);

        emit LetterIssued(
            letterId,
            msg.sender,
            p.agentId,
            agentWallet,
            p.asset,
            p.faceValue,
            p.fee,
            p.maxPerCall,
            p.expiry,
            p.validator,
            p.minScore,
            p.termsHash,
            p.termsURI
        );
    }

    // --- the agent acting under mandate -------------------------------------

    /**
     * @notice Pay an allowlisted recipient out of working capital.
     * @dev Works for native and ERC-20 letters. This is the path a disallowed
     *      payment fails on: an off-mandate recipient reverts with
     *      RecipientNotAllowed and the attempt stays on-chain as a failed tx.
     */
    function payTo(uint256 letterId, address recipient, uint256 amount) external nonReentrant {
        Letter storage L = _requireActing(letterId);
        if (!_allowedRecipient[letterId][recipient]) revert RecipientNotAllowed(recipient);
        _spend(L, letterId, amount);

        if (L.asset == NATIVE) {
            (bool ok, bytes memory ret) = recipient.call{value: amount}("");
            if (!ok) revert CallFailed(ret);
        } else {
            IERC20(L.asset).safeTransfer(recipient, amount);
        }
        emit Paid(letterId, recipient, amount, L.spent);
    }

    /**
     * @notice Call an allowlisted target with an allowlisted selector.
     * @dev `value` is only meaningful for native letters. Selector 0x00000000
     *      denotes a plain value transfer with empty calldata and must be
     *      allowlisted explicitly if the applicant wants to permit it.
     */
    function execute(uint256 letterId, address target, uint256 value, bytes calldata data)
        external
        nonReentrant
        returns (bytes memory)
    {
        Letter storage L = _requireActing(letterId);
        if (L.asset != NATIVE && value != 0) revert ValueNotAllowedForERC20Letter();
        if (!_allowedTarget[letterId][target]) revert TargetNotAllowed(target);

        bytes4 selector = data.length >= 4 ? bytes4(data[:4]) : bytes4(0);
        if (!_allowedSelector[letterId][selector]) revert SelectorNotAllowed(selector);

        if (value > 0) _spend(L, letterId, value);

        (bool ok, bytes memory ret) = target.call{value: value}(data);
        if (!ok) revert CallFailed(ret);

        emit Executed(letterId, target, selector, value, L.spent);
        return ret;
    }

    /**
     * @notice Put the documents for this job on-chain and stop acting.
     *
     * @dev `documents` is emitted in full so the evidence is readable directly
     *      from the explorer with no off-chain service to trust or keep alive.
     *      `docHash` is what the examiner scores in the Validation Registry.
     *
     *      When a body is supplied it must hash to `docHash`. Without this the
     *      claim "the evidence is the event" would be false: an agent could emit
     *      one document body while committing the examiner to a different hash,
     *      and a reader opening the transaction would see bytes that have nothing
     *      to do with what was scored.
     *
     *      An empty body is still permitted and means hash-only presentation, with
     *      the documents held off-chain at `documentURI`. That is the ordinary
     *      arrangement for a credit whose documents are bulky or confidential; the
     *      invariant that matters is that an on-chain body always certifies itself.
     */
    function presentDocuments(uint256 letterId, string calldata documentURI, bytes32 docHash, bytes calldata documents)
        external
    {
        Letter storage L = _requireActing(letterId);
        if (docHash == bytes32(0)) revert BadParams("docHash");
        if (documents.length > 0 && keccak256(documents) != docHash) revert DocumentHashMismatch(keccak256(documents), docHash);

        L.docHash = docHash;
        L.presentedAt = uint64(block.timestamp);
        L.status = Status.Presented;
        _docURI[letterId] = documentURI;

        emit DocumentsPresented(letterId, L.agentId, docHash, documentURI, documents);
    }

    // --- settlement ---------------------------------------------------------

    /**
     * @notice Draw the fee against compliant documents.
     * @dev Permissionless: anyone may trigger settlement, because every condition
     *      is checked on-chain. The examination is read from the ERC-8004
     *      Validation Registry — it must be the validator named at issuance,
     *      scoring this letter's agent and this letter's exact document hash.
     */
    function draw(uint256 letterId) external nonReentrant {
        Letter storage L = _letters[letterId];
        if (L.status != Status.Presented) revert BadStatus(L.status, Status.Presented);

        uint64 openUntil = L.presentedAt + L.disputeWindow;
        if (block.timestamp < openUntil) revert DisputeWindowOpen(openUntil);

        uint8 score = _requireExamined(L);

        uint256 fee = L.fee;
        uint256 remainder = L.faceValue - L.spent - fee;
        address payee = ownerOf(letterId);

        L.status = Status.Settled;
        L.spent = L.faceValue; // nothing further is claimable

        if (fee > 0) _send(L.asset, payee, fee);
        if (remainder > 0) _send(L.asset, L.applicant, remainder);

        emit Drawn(letterId, payee, fee, remainder, score);
        _writeFeedback(letterId, L, int128(uint128(score)), "letter.settled");
    }

    /// @notice The applicant objects to the presentation inside the dispute window.
    function dispute(uint256 letterId, string calldata reasonURI) external {
        Letter storage L = _letters[letterId];
        if (msg.sender != L.applicant) revert NotApplicant();
        if (L.status != Status.Presented) revert BadStatus(L.status, Status.Presented);

        uint64 until = L.presentedAt + L.disputeWindow;
        if (block.timestamp >= until) revert DisputeWindowClosed(until);

        L.status = Status.Disputed;
        emit Disputed(letterId, msg.sender, reasonURI);
    }

    /**
     * @notice The named examiner resolves a dispute.
     * @dev Only the fee is at stake. Working capital already moved under the
     *      mandate is gone by construction — the mandate is what prevents loss,
     *      the dispute governs whether the agent earned its fee.
     */
    function resolveDispute(uint256 letterId, bool favourBeneficiary, string calldata resolutionURI)
        external
        nonReentrant
    {
        Letter storage L = _letters[letterId];
        if (L.status != Status.Disputed) revert BadStatus(L.status, Status.Disputed);
        if (msg.sender != L.validator) revert NotValidator(msg.sender, L.validator);

        uint256 fee = L.fee;
        uint256 unspent = L.faceValue - L.spent;
        emit DisputeResolved(letterId, favourBeneficiary, resolutionURI);

        if (favourBeneficiary) {
            uint256 remainder = unspent - fee;
            address payee = ownerOf(letterId);
            L.status = Status.Settled;
            L.spent = L.faceValue;
            if (fee > 0) _send(L.asset, payee, fee);
            if (remainder > 0) _send(L.asset, L.applicant, remainder);
            emit Drawn(letterId, payee, fee, remainder, L.minScore);
            _writeFeedback(letterId, L, int128(uint128(L.minScore)), "letter.disputed.upheld");
        } else {
            L.status = Status.Refunded;
            L.spent = L.faceValue;
            if (unspent > 0) _send(L.asset, L.applicant, unspent);
            emit Refunded(letterId, L.applicant, unspent, Status.Refunded);
            _writeFeedback(letterId, L, 0, "letter.disputed.rejected");
        }
    }

    /**
     * @notice After expiry, the applicant reclaims whatever was not spent.
     * @dev Disputed letters are refundable here too, otherwise an examiner that
     *      goes offline would strand the funds permanently. The trade-off is that
     *      an applicant could dispute and then wait out the clock; the mitigations
     *      are that the agent chooses which examiners it will work under, and that
     *      it can present and draw well before expiry with a short dispute window.
     */
    function refundExpired(uint256 letterId) external nonReentrant {
        Letter storage L = _letters[letterId];
        if (L.status != Status.Open && L.status != Status.Presented && L.status != Status.Disputed) {
            revert BadStatus(L.status, Status.Open);
        }
        if (block.timestamp <= L.expiry) revert NotYetExpired(L.expiry);

        uint256 unspent = L.faceValue - L.spent;
        L.status = Status.Refunded;
        L.spent = L.faceValue;
        if (unspent > 0) _send(L.asset, L.applicant, unspent);
        emit Refunded(letterId, L.applicant, unspent, Status.Refunded);
    }

    /// @notice Withdraw an untouched letter before the agent has spent anything.
    function cancel(uint256 letterId) external nonReentrant {
        Letter storage L = _letters[letterId];
        if (msg.sender != L.applicant) revert NotApplicant();
        if (L.status != Status.Open) revert BadStatus(L.status, Status.Open);
        if (L.spent != 0) revert BadParams("already spent");

        uint256 amount = L.faceValue;
        L.status = Status.Cancelled;
        L.spent = L.faceValue;
        _send(L.asset, L.applicant, amount);
        emit Refunded(letterId, L.applicant, amount, Status.Cancelled);
    }

    // --- internals ----------------------------------------------------------

    /// @dev Common gate for every agent action: status, expiry, and bound wallet.
    function _requireActing(uint256 letterId) private view returns (Letter storage L) {
        L = _letters[letterId];
        if (L.status != Status.Open) revert BadStatus(L.status, Status.Open);
        if (block.timestamp > L.expiry) revert LetterExpired(L.expiry, block.timestamp);

        address wallet = identity.getAgentWallet(L.agentId);
        if (wallet == address(0)) revert AgentWalletUnset(L.agentId);
        if (msg.sender != wallet) revert NotAgentWallet(msg.sender, wallet);
    }

    function _spend(Letter storage L, uint256 letterId, uint256 amount) private {
        if (amount == 0) revert BadParams("amount");
        uint256 cap = _maxPerCall[letterId];
        if (amount > cap) revert ExceedsPerCallCap(amount, cap);

        uint256 avail = L.faceValue - L.fee - L.spent;
        if (amount > avail) revert InsufficientCredit(amount, avail);
        L.spent += amount;
    }

    /**
     * @dev Reads the ERC-8004 examination and enforces subject + threshold.
     *      Uses nothing beyond the ERC-8004 interface, so this contract can be
     *      repointed at the canonical registries unchanged. A request that has
     *      been opened but not answered reads as response 0, which is why
     *      `minScore` is required to be at least 1 at issuance: an unexamined
     *      presentation can never clear the threshold.
     */
    function _requireExamined(Letter storage L) private view returns (uint8 score) {
        try validation.getValidationStatus(L.docHash) returns (
            address validator, uint256 agentId, uint8 response, bytes32, string memory, uint256
        ) {
            if (validator != L.validator || agentId != L.agentId) revert WrongValidationSubject();
            if (response < L.minScore) revert ScoreBelowThreshold(response, L.minScore);
            return response;
        } catch {
            // No validation request was ever opened over this document hash.
            revert DocumentsNotExamined(L.docHash);
        }
    }

    function _send(address asset, address to, uint256 amount) private {
        if (asset == NATIVE) {
            (bool ok, bytes memory ret) = to.call{value: amount}("");
            if (!ok) revert CallFailed(ret);
        } else {
            IERC20(asset).safeTransfer(to, amount);
        }
    }

    /// @dev A misbehaving registry must never be able to strand settled funds.
    function _writeFeedback(uint256 letterId, Letter storage L, int128 value, string memory tag) private {
        try reputation.giveFeedback(L.agentId, value, 0, tag, "", "", _docURI[letterId], L.docHash) {}
        catch {
            emit FeedbackFailed(letterId, L.agentId);
        }
    }

    // --- views --------------------------------------------------------------

    function getLetter(uint256 letterId) external view returns (Letter memory) {
        return _letters[letterId];
    }

    function maxPerCall(uint256 letterId) external view returns (uint256) {
        return _maxPerCall[letterId];
    }

    function docURI(uint256 letterId) external view returns (string memory) {
        return _docURI[letterId];
    }

    /// @notice Working capital still spendable under the mandate.
    function available(uint256 letterId) external view returns (uint256) {
        Letter storage L = _letters[letterId];
        if (L.status != Status.Open) return 0;
        return L.faceValue - L.fee - L.spent;
    }

    function totalLetters() external view returns (uint256) {
        return _nextId - 1;
    }

    function mandate(uint256 letterId)
        external
        view
        returns (address[] memory recipients, address[] memory targets, bytes4[] memory selectors, uint256 perCallCap)
    {
        return (_recipientList[letterId], _targetList[letterId], _selectorList[letterId], _maxPerCall[letterId]);
    }

    function isAllowedRecipient(uint256 letterId, address r) external view returns (bool) {
        return _allowedRecipient[letterId][r];
    }

    function isAllowedTarget(uint256 letterId, address t) external view returns (bool) {
        return _allowedTarget[letterId][t];
    }

    function isAllowedSelector(uint256 letterId, bytes4 s) external view returns (bool) {
        return _allowedSelector[letterId][s];
    }

    /// @dev Letters hold value; they must not be burned or sent to the zero address.
    receive() external payable {
        revert BadParams("direct transfer");
    }
}

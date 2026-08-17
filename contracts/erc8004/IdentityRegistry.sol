// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";

/**
 * @title ERC-8004 Identity Registry
 * @notice An agent is an ERC-721 token. The token owner is the principal; the
 *         `agentWallet` is the key the agent actually acts with, bound by an
 *         EIP-712 signature from that wallet so a principal cannot name a wallet
 *         it does not control.
 *
 * @dev Port of the ERC-8004 reference implementation
 *      (github.com/erc-8004/erc-8004-contracts, IdentityRegistryUpgradeable.sol)
 *      to a non-upgradeable contract. The external ABI is unchanged, so anything
 *      written against the canonical registries works against this one.
 *
 *      Why a local deployment instead of the canonical addresses: on BOT Chain
 *      mainnet (677) the canonical proxies 0x8004A169...a432 and 0x8004BAa1...9b63
 *      exist but point at `MinimalUUPSMainnet` placeholders — `name()` reverts,
 *      no registry logic is reachable — and their upgrade key is held by the
 *      ERC-8004 deployer (0x5472...2603). They are reserved, not live. See
 *      docs/RESEARCH.md for the on-chain evidence.
 *
 *      agentIds start at 0, matching the reference implementation. Never treat
 *      agentId 0 as "unset"; use ownerOf(), which reverts for nonexistent ids.
 */
contract IdentityRegistry is ERC721URIStorage, EIP712 {
    struct MetadataEntry {
        string metadataKey;
        bytes metadataValue;
    }

    uint256 private _lastId;
    // agentId => metadataKey => metadataValue (includes the reserved "agentWallet")
    mapping(uint256 => mapping(string => bytes)) private _metadata;

    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event MetadataSet(
        uint256 indexed agentId,
        string indexed indexedMetadataKey,
        string metadataKey,
        bytes metadataValue
    );
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);

    bytes32 private constant AGENT_WALLET_SET_TYPEHASH =
        keccak256("AgentWalletSet(uint256 agentId,address newWallet,address owner,uint256 deadline)");
    bytes4 private constant ERC1271_MAGICVALUE = 0x1626ba7e;
    uint256 private constant MAX_DEADLINE_DELAY = 5 minutes;
    bytes32 private constant RESERVED_AGENT_WALLET_KEY_HASH = keccak256("agentWallet");

    constructor() ERC721("AgentIdentity", "AGENT") EIP712("ERC8004IdentityRegistry", "1") {}

    // --- registration -------------------------------------------------------

    function register() external returns (uint256 agentId) {
        agentId = _register("");
    }

    function register(string memory agentURI) external returns (uint256 agentId) {
        agentId = _register(agentURI);
    }

    function register(string memory agentURI, MetadataEntry[] memory metadata)
        external
        returns (uint256 agentId)
    {
        agentId = _register(agentURI);
        for (uint256 i; i < metadata.length; i++) {
            require(keccak256(bytes(metadata[i].metadataKey)) != RESERVED_AGENT_WALLET_KEY_HASH, "reserved key");
            _metadata[agentId][metadata[i].metadataKey] = metadata[i].metadataValue;
            emit MetadataSet(agentId, metadata[i].metadataKey, metadata[i].metadataKey, metadata[i].metadataValue);
        }
    }

    function _register(string memory agentURI) private returns (uint256 agentId) {
        agentId = _lastId++;
        _metadata[agentId]["agentWallet"] = abi.encodePacked(msg.sender);
        _safeMint(msg.sender, agentId);
        if (bytes(agentURI).length > 0) {
            _setTokenURI(agentId, agentURI);
        }
        emit Registered(agentId, agentURI, msg.sender);
        emit MetadataSet(agentId, "agentWallet", "agentWallet", abi.encodePacked(msg.sender));
    }

    // --- metadata -----------------------------------------------------------

    function getMetadata(uint256 agentId, string memory metadataKey) external view returns (bytes memory) {
        return _metadata[agentId][metadataKey];
    }

    function setMetadata(uint256 agentId, string memory metadataKey, bytes memory metadataValue) external {
        _requireAuthorized(agentId);
        require(keccak256(bytes(metadataKey)) != RESERVED_AGENT_WALLET_KEY_HASH, "reserved key");
        _metadata[agentId][metadataKey] = metadataValue;
        emit MetadataSet(agentId, metadataKey, metadataKey, metadataValue);
    }

    function setAgentURI(uint256 agentId, string calldata newURI) external {
        _requireAuthorized(agentId);
        _setTokenURI(agentId, newURI);
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    // --- agent wallet binding ----------------------------------------------

    function getAgentWallet(uint256 agentId) external view returns (address) {
        bytes memory walletData = _metadata[agentId]["agentWallet"];
        return address(bytes20(walletData));
    }

    /**
     * @notice Bind `newWallet` to `agentId`. Requires a signature from
     *         `newWallet` itself, so a principal cannot claim someone else's key.
     */
    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature)
        external
    {
        address owner = ownerOf(agentId);
        _requireAuthorized(agentId);
        require(newWallet != address(0), "bad wallet");
        require(block.timestamp <= deadline, "expired");
        require(deadline <= block.timestamp + MAX_DEADLINE_DELAY, "deadline too far");

        bytes32 structHash =
            keccak256(abi.encode(AGENT_WALLET_SET_TYPEHASH, agentId, newWallet, owner, deadline));
        bytes32 digest = _hashTypedDataV4(structHash);

        // ECDSA first (EOAs, incl. EIP-7702 delegated), then ERC-1271 wallets.
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
        if (err != ECDSA.RecoverError.NoError || recovered != newWallet) {
            (bool ok, bytes memory res) =
                newWallet.staticcall(abi.encodeCall(IERC1271.isValidSignature, (digest, signature)));
            require(ok && res.length >= 32 && abi.decode(res, (bytes4)) == ERC1271_MAGICVALUE, "invalid wallet sig");
        }

        _metadata[agentId]["agentWallet"] = abi.encodePacked(newWallet);
        emit MetadataSet(agentId, "agentWallet", "agentWallet", abi.encodePacked(newWallet));
    }

    function unsetAgentWallet(uint256 agentId) external {
        _requireAuthorized(agentId);
        _metadata[agentId]["agentWallet"] = "";
        emit MetadataSet(agentId, "agentWallet", "agentWallet", "");
    }

    // --- helpers ------------------------------------------------------------

    /// @dev Reverts with ERC721NonexistentToken if the agent does not exist.
    function isAuthorizedOrOwner(address spender, uint256 agentId) external view returns (bool) {
        address owner = ownerOf(agentId);
        return _isAuthorized(owner, spender, agentId);
    }

    function totalRegistered() external view returns (uint256) {
        return _lastId;
    }

    function getVersion() external pure returns (string memory) {
        return "2.0.0";
    }

    function _requireAuthorized(uint256 agentId) private view {
        address owner = ownerOf(agentId);
        require(
            msg.sender == owner || isApprovedForAll(owner, msg.sender) || msg.sender == getApproved(agentId),
            "Not authorized"
        );
    }

    /**
     * @dev Selling the agent must not hand over its live signing key, so the
     *      bound wallet is cleared on transfer. Cleared before super._update()
     *      to keep checks-effects-interactions ahead of the ERC-721 receiver call.
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            _metadata[tokenId]["agentWallet"] = "";
            emit MetadataSet(tokenId, "agentWallet", "agentWallet", "");
        }
        return super._update(to, tokenId, auth);
    }
}

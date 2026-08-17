// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ERC-8004 (Trustless Agents) consumer interfaces
 * @notice Only the functions LETTER actually calls. Signatures match the
 *         ERC-8004 draft and the canonical reference implementation at
 *         github.com/erc-8004/erc-8004-contracts, so LETTER can be repointed at
 *         the canonical registries on any chain where they are functional.
 */
interface IIdentityRegistry {
    /// @notice ERC-721 owner of the agent (the principal that controls it).
    function ownerOf(uint256 agentId) external view returns (address);

    /// @notice The wallet cryptographically bound to this agent, or address(0).
    function getAgentWallet(uint256 agentId) external view returns (address);

    /// @notice True if `spender` owns or is approved to act for `agentId`.
    function isAuthorizedOrOwner(address spender, uint256 agentId) external view returns (bool);

    function tokenURI(uint256 agentId) external view returns (string memory);
}

interface IReputationRegistry {
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;

    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2
    ) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals);
}

interface IValidationRegistry {
    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestHash
    ) external;

    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseHash,
        string calldata tag
    ) external;

    /// @dev Reverts with "unknown" if no request was ever opened for `requestHash`.
    function getValidationStatus(bytes32 requestHash)
        external
        view
        returns (
            address validatorAddress,
            uint256 agentId,
            uint8 response,
            bytes32 responseHash,
            string memory tag,
            uint256 lastUpdate
        );
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ServiceVendor
 * @notice A minimal counterparty for the demo: an approved supplier that an agent
 *         is allowed to pay under a mandate. It exists so `execute` has a real
 *         contract target with a real selector to allowlist, rather than only
 *         plain transfers.
 *
 * @dev Deliberately dumb. It records who paid, how much, and against which
 *      ref, so the settlement is independently checkable from the vendor's
 *      side as well as the letter's.
 */
contract ServiceVendor {
    struct Invoice {
        address payer;
        uint256 amount;
        uint64 paidAt;
    }

    address public immutable operator;
    mapping(bytes32 => Invoice) public invoices;
    uint256 public totalReceived;

    event InvoiceSettled(bytes32 indexed ref, address indexed payer, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    error AlreadySettled(bytes32 ref);
    error NoValue();
    error NotOperator();

    constructor(address operator_) {
        operator = operator_ == address(0) ? msg.sender : operator_;
    }

    /// @notice Settle an invoice by ref. Selector: `invoice(bytes32)`.
    function invoice(bytes32 ref) external payable {
        if (msg.value == 0) revert NoValue();
        if (invoices[ref].paidAt != 0) revert AlreadySettled(ref);

        invoices[ref] =
            Invoice({payer: msg.sender, amount: msg.value, paidAt: uint64(block.timestamp)});
        totalReceived += msg.value;
        emit InvoiceSettled(ref, msg.sender, msg.value);
    }

    function withdraw(address to) external {
        if (msg.sender != operator) revert NotOperator();
        uint256 amount = address(this).balance;
        (bool ok,) = to.call{value: amount}("");
        require(ok, "withdraw failed");
        emit Withdrawn(to, amount);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Custom errors for gas efficiency
error NotAdmin();
error CertificateAlreadyExists(string id);
error CertificateNotFound(string id);
error EmptyId();
error EmptyHash();
error BatchLengthMismatch();
error BatchEmpty();
error BatchTooLarge(uint256 provided, uint256 maxAllowed);
error DuplicateIdInBatch(string id);

/// @title CertChain - Decentralized Certificate Verification
/// @notice Allows an admin to store certificate hashes and anyone to verify them
contract CertificateVerification {
    address public admin;

    // Certificate ID => IPFS/SHA-256 hash
    mapping(string => string) private certificates;
    // Track existence separately for gas-efficient checks
    mapping(string => bool) private exists;

    /// @dev Hard cap on a single batch to keep gas usage bounded
    uint256 public constant MAX_BATCH_SIZE = 100;

    event CertificateAdded(string indexed id, string hash, uint256 timestamp);

    /// @notice Emitted once per successful batch issuance
    /// @param count  Number of certificates issued in this batch
    /// @param timestamp Block timestamp of the batch transaction
    event BatchIssued(uint256 count, uint256 timestamp);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    /// @notice Add a new certificate (admin only)
    /// @param _id Unique certificate identifier
    /// @param _hash IPFS CID or SHA-256 hash of the certificate
    function addCertificate(
        string calldata _id,
        string calldata _hash
    ) external onlyAdmin {
        if (bytes(_id).length == 0) revert EmptyId();
        if (bytes(_hash).length == 0) revert EmptyHash();
        if (exists[_id]) revert CertificateAlreadyExists(_id);

        certificates[_id] = _hash;
        exists[_id] = true;

        emit CertificateAdded(_id, _hash, block.timestamp);
    }

    /// @notice Issue multiple certificates in a single transaction (admin only).
    /// @dev    Arrays must be equal length, non-empty, and <= MAX_BATCH_SIZE.
    ///         No ID may appear twice within the batch, and none may already
    ///         exist on-chain.  Each certificate is stored individually so
    ///         verifyCertificate() continues to work per-ID.
    /// @param _ids    Parallel array of unique certificate identifiers
    /// @param _hashes Parallel array of IPFS CIDs / SHA-256 hashes
    function addCertificateBatch(
        string[] calldata _ids,
        string[] calldata _hashes
    ) external onlyAdmin {
        uint256 len = _ids.length;

        // ── Structural validations ──────────────────────────────────────────
        if (len == 0) revert BatchEmpty();
        if (len != _hashes.length) revert BatchLengthMismatch();
        if (len > MAX_BATCH_SIZE) revert BatchTooLarge(len, MAX_BATCH_SIZE);

        // ── Duplicate & existence check ─────────────────────────────────────
        // We use a temporary in-memory mapping simulation via a nested loop
        // for small batches; for up to 100 items this is acceptable on-chain.
        for (uint256 i = 0; i < len; i++) {
            string calldata id = _ids[i];
            string calldata hash = _hashes[i];

            if (bytes(id).length == 0) revert EmptyId();
            if (bytes(hash).length == 0) revert EmptyHash();

            // Must not already exist on-chain
            if (exists[id]) revert CertificateAlreadyExists(id);

            // Must not appear again later in the same batch
            for (uint256 j = i + 1; j < len; j++) {
                if (
                    keccak256(bytes(id)) == keccak256(bytes(_ids[j]))
                ) revert DuplicateIdInBatch(id);
            }
        }

        // ── Persist ─────────────────────────────────────────────────────────
        for (uint256 i = 0; i < len; i++) {
            certificates[_ids[i]] = _hashes[i];
            exists[_ids[i]] = true;
            emit CertificateAdded(_ids[i], _hashes[i], block.timestamp);
        }

        emit BatchIssued(len, block.timestamp);
    }

    /// @notice Verify a certificate by its ID
    /// @param _id Certificate identifier to look up
    /// @return The stored hash for the certificate
    function verifyCertificate(
        string calldata _id
    ) external view returns (string memory) {
        if (!exists[_id]) revert CertificateNotFound(_id);
        return certificates[_id];
    }

    /// @notice Check if a certificate exists
    /// @param _id Certificate identifier
    /// @return True if the certificate exists
    function certificateExists(
        string calldata _id
    ) external view returns (bool) {
        return exists[_id];
    }
}

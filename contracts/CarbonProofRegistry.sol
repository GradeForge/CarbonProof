// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CarbonProofRegistry
 * @notice Minimal evidence fingerprint registry for CarbonProof.
 *
 * Registers a SHA-256 evidence fingerprint (bytes32) alongside a hash of the
 * CarbonProof record ID. The contract prevents duplicate fingerprint
 * registration at the protocol level — a second registration of the same
 * fingerprint reverts.
 *
 * This contract does NOT certify carbon credits, verify environmental claims,
 * transfer funds, mint tokens, or store documents. It only proves that a
 * particular fingerprint was registered on-chain by a specific wallet at a
 * specific time.
 */
contract CarbonProofRegistry {
    struct Registration {
        bytes32 recordIdHash;
        address registrar;
        uint256 registeredAt;
        bool exists;
    }

    /// @dev Mapping keyed by evidence fingerprint — authoritative duplicate prevention.
    mapping(bytes32 => Registration) private _registrations;

    /// @notice Emitted when a new evidence fingerprint is registered.
    event EvidenceRegistered(
        bytes32 indexed evidenceFingerprint,
        bytes32 indexed recordIdHash,
        address indexed registrar
    );

    /// @notice Register a new evidence fingerprint with its record ID hash.
    /// @dev Reverts if the fingerprint or record ID hash is zero, or if the
    ///      fingerprint has already been registered.
    /// @param evidenceFingerprint The SHA-256 fingerprint of canonical evidence fields.
    /// @param recordIdHash A keccak256 hash of the CarbonProof record ID (UUID string).
    function registerEvidence(bytes32 evidenceFingerprint, bytes32 recordIdHash) external {
        require(evidenceFingerprint != bytes32(0), "CarbonProof: zero evidence fingerprint");
        require(recordIdHash != bytes32(0), "CarbonProof: zero record ID hash");
        require(!_registrations[evidenceFingerprint].exists, "CarbonProof: fingerprint already registered");

        _registrations[evidenceFingerprint] = Registration({
            recordIdHash: recordIdHash,
            registrar: msg.sender,
            registeredAt: block.timestamp,
            exists: true
        });

        emit EvidenceRegistered(evidenceFingerprint, recordIdHash, msg.sender);
    }

    /// @notice Check whether an evidence fingerprint has been registered.
    /// @param evidenceFingerprint The SHA-256 fingerprint to check.
    /// @return True if the fingerprint has been registered, false otherwise.
    function isRegistered(bytes32 evidenceFingerprint) external view returns (bool) {
        return _registrations[evidenceFingerprint].exists;
    }

    /// @notice Get registration details for an evidence fingerprint.
    /// @param evidenceFingerprint The SHA-256 fingerprint to query.
    /// @return recordIdHash The hash of the CarbonProof record ID.
    /// @return registrar The wallet address that registered the fingerprint.
    /// @return registeredAt The block timestamp of registration.
    /// @return exists Whether the fingerprint is registered.
    function getRegistration(bytes32 evidenceFingerprint)
        external
        view
        returns (bytes32 recordIdHash, address registrar, uint256 registeredAt, bool exists)
    {
        Registration memory reg = _registrations[evidenceFingerprint];
        return (reg.recordIdHash, reg.registrar, reg.registeredAt, reg.exists);
    }
}

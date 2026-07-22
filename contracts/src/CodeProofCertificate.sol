// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract CodeProofCertificate {
    string public constant name = "CodeProof Certificate";
    string public constant symbol = "CODEPROOF";

    address public immutable registry;
    uint256 public nextTokenId;

    struct CertificateData {
        uint256 reviewId;
        uint32 version;
        bytes32 reportHash;
        string reportURI;
    }

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => CertificateData) private _certificateData;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Locked(uint256 indexed tokenId);
    event CertificateIssued(
        uint256 indexed tokenId,
        uint256 indexed reviewId,
        uint32 indexed version,
        bytes32 reportHash
    );

    error OnlyRegistry();
    error InvalidRecipient();
    error NonexistentToken();
    error Soulbound();

    constructor(address registry_) {
        if (registry_ == address(0)) revert InvalidRecipient();
        registry = registry_;
    }

    function mint(
        address to,
        uint256 reviewId,
        uint32 version,
        bytes32 reportHash,
        string calldata reportURI
    ) external returns (uint256 tokenId) {
        if (msg.sender != registry) revert OnlyRegistry();
        if (to == address(0)) revert InvalidRecipient();

        tokenId = nextTokenId++;
        _owners[tokenId] = to;
        _balances[to]++;
        _certificateData[tokenId] = CertificateData({
            reviewId: reviewId,
            version: version,
            reportHash: reportHash,
            reportURI: reportURI
        });

        emit Transfer(address(0), to, tokenId);
        emit Locked(tokenId);
        emit CertificateIssued(tokenId, reviewId, version, reportHash);
    }

    function ownerOf(uint256 tokenId) public view returns (address owner) {
        owner = _owners[tokenId];
        if (owner == address(0)) revert NonexistentToken();
    }

    function balanceOf(address owner) external view returns (uint256) {
        if (owner == address(0)) revert InvalidRecipient();
        return _balances[owner];
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        ownerOf(tokenId);
        return _certificateData[tokenId].reportURI;
    }

    function certificateData(uint256 tokenId)
        external
        view
        returns (CertificateData memory)
    {
        ownerOf(tokenId);
        return _certificateData[tokenId];
    }

    function locked(uint256 tokenId) external view returns (bool) {
        ownerOf(tokenId);
        return true;
    }

    function approve(address, uint256) external pure {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) external pure {
        revert Soulbound();
    }

    function transferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert Soulbound();
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        ownerOf(tokenId);
        return address(0);
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        return false;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7
            || interfaceId == 0x80ac58cd
            || interfaceId == 0x5b5e139f
            || interfaceId == 0xb45a3c0e;
    }
}

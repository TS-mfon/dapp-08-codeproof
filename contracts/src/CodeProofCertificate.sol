// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CodeProofCertificate is ERC721, Ownable {
    event Locked(uint256 indexed tokenId);

    uint256 public nextTokenId;
    address public registry;

    mapping(uint256 => string) private _tokenURIs;

    modifier onlyRegistry() {
        require(msg.sender == registry, "Only registry can call");
        _;
    }

    constructor(address _registry) ERC721("CodeProof Certificate", "CPCERT") Ownable(msg.sender) {
        require(_registry != address(0), "Registry cannot be zero address");
        registry = _registry;
    }

    function mint(address to, string calldata reportURI) external onlyRegistry returns (uint256) {
        uint256 tokenId = nextTokenId++;
        _safeMint(to, tokenId);
        _tokenURIs[tokenId] = reportURI;
        emit Locked(tokenId);
        return tokenId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "ERC721: invalid token ID");
        return _tokenURIs[tokenId];
    }

    // ERC5192 lock status: always locked for Soulbound
    function locked(uint256 tokenId) external view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "ERC721: invalid token ID");
        return true;
    }

    // OpenZeppelin v5: intercept transfers at the base level to implement Soulbound behavior
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert("Soulbound: transfer disabled");
        }
        return super._update(to, tokenId, auth);
    }
}

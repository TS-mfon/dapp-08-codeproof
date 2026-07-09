// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/CodeProofReviewRegistry.sol";
import "../src/CodeProofCertificate.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy Registry
        CodeProofReviewRegistry registry = new CodeProofReviewRegistry();
        console.log("Registry deployed at:", address(registry));

        // Deploy Certificate
        CodeProofCertificate certificate = new CodeProofCertificate(address(registry));
        console.log("Certificate deployed at:", address(certificate));

        // Wire together
        registry.setCertificateContract(address(certificate));
        console.log("Certificate contract wired to registry.");

        vm.stopBroadcast();
    }
}

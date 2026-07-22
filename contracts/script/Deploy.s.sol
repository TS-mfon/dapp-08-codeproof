// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CodeProofCertificate} from "../src/CodeProofCertificate.sol";
import {CodeProofReviewRegistry} from "../src/CodeProofReviewRegistry.sol";

contract DeployCodeProof is Script {
    function run() external returns (
        CodeProofReviewRegistry registry,
        CodeProofCertificate certificate
    ) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envOr("TREASURY_ADDRESS", vm.addr(deployerKey));

        vm.startBroadcast(deployerKey);
        registry = new CodeProofReviewRegistry(treasury);
        certificate = new CodeProofCertificate(address(registry));
        registry.setCertificateContract(address(certificate));
        vm.stopBroadcast();

        console2.log("CodeProofReviewRegistry:", address(registry));
        console2.log("CodeProofCertificate:", address(certificate));
    }
}

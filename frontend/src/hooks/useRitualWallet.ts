import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import { useState, useCallback } from "react";

const RITUAL_WALLET = "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948" as const;

const ritualWalletAbi = [
  { 
    type: "function", 
    name: "balanceOf", 
    inputs: [{ name: "user", type: "address" }], 
    outputs: [{ type: "uint256" }], 
    stateMutability: "view" 
  },
  { 
    type: "function", 
    name: "lockUntil", 
    inputs: [{ name: "user", type: "address" }], 
    outputs: [{ type: "uint256" }], 
    stateMutability: "view" 
  },
  { 
    type: "function", 
    name: "deposit", 
    inputs: [{ name: "lockDuration", type: "uint256" }], 
    outputs: [], 
    stateMutability: "payable" 
  },
  { 
    type: "function", 
    name: "withdraw", 
    inputs: [{ name: "amount", type: "uint256" }], 
    outputs: [], 
    stateMutability: "nonpayable" 
  },
] as const;

export function useRitualWallet() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: RITUAL_WALLET,
    abi: ritualWalletAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 12_000 },
  });

  const { data: lockUntilBlock } = useReadContract({
    address: RITUAL_WALLET,
    abi: ritualWalletAbi,
    functionName: "lockUntil",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ 
    hash: pendingTxHash, 
    query: { enabled: !!pendingTxHash } 
  });

  const deposit = useCallback(async (amountEther: string, lockDurationBlocks: bigint = BigInt(5000)) => {
    const hash = await writeContractAsync({ 
      address: RITUAL_WALLET, 
      abi: ritualWalletAbi, 
      functionName: "deposit", 
      args: [lockDurationBlocks], 
      value: parseEther(amountEther) 
    });
    setPendingTxHash(hash);
    return hash;
  }, [writeContractAsync]);

  const withdraw = useCallback(async (amountEther: string) => {
    const hash = await writeContractAsync({ 
      address: RITUAL_WALLET, 
      abi: ritualWalletAbi, 
      functionName: "withdraw", 
      args: [parseEther(amountEther)] 
    });
    setPendingTxHash(hash);
    return hash;
  }, [writeContractAsync]);

  return { 
    balance, 
    balanceFormatted: balance ? formatEther(balance) : "0", 
    lockUntilBlock, 
    deposit, 
    withdraw, 
    isConfirming, 
    refetchBalance 
  };
}

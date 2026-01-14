// ZeroDev smart account utilities for Ethereum (Sepolia)

import { createKernelAccount, createKernelAccountClient, createZeroDevPaymasterClient, getUserOperationGasPrice } from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { http, createPublicClient, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { getEntryPoint, KERNEL_V3_0 } from '@zerodev/sdk/constants';
import { Buffer } from 'buffer';

// ZeroDev project configuration
const ZERODEV_PROJECT_ID = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID || '';

// V3 RPC format: https://rpc.zerodev.app/api/v3/{projectId}/chain/{chainId}
const ZERODEV_RPC = `https://rpc.zerodev.app/api/v3/${ZERODEV_PROJECT_ID}/chain/${sepolia.id}`;

// ETH RPC for public client
const ETH_RPC = process.env.NEXT_PUBLIC_ETH_RPC || 'https://eth-sepolia.g.alchemy.com/v2/zNJmop9_ak2kOQELujgaZ9RExxSi6Q8S';

// Entry point and kernel version (tested working)
const entryPoint = getEntryPoint('0.7');
const kernelVersion = KERNEL_V3_0;

// Create ZeroDev Kernel account from private key
export async function createSmartAccount(privateKey: `0x${string}`) {
  if (!ZERODEV_PROJECT_ID) {
    throw new Error('ZeroDev project ID not configured. Set NEXT_PUBLIC_ZERODEV_PROJECT_ID in .env.local');
  }

  // Public client using Alchemy RPC
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(ETH_RPC),
  });

  // Create signer from private key
  const signer = privateKeyToAccount(privateKey);

  // Create ECDSA validator
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer,
    entryPoint,
    kernelVersion,
  });

  // Create Kernel account
  const account = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
    entryPoint,
    kernelVersion,
  });

  return { account, publicClient };
}

// Create Kernel account client with paymaster
export async function createAccountClient(privateKey: `0x${string}`) {
  const { account, publicClient } = await createSmartAccount(privateKey);

  // Create paymaster client for gas sponsorship
  const paymasterClient = createZeroDevPaymasterClient({
    chain: sepolia,
    transport: http(ZERODEV_RPC),
  });

  // Create account client
  const kernelClient = createKernelAccountClient({
    account,
    chain: sepolia,
    bundlerTransport: http(ZERODEV_RPC),
    client: publicClient,
    paymaster: {
      getPaymasterData: async (userOperation) => {
        return paymasterClient.sponsorUserOperation({ userOperation });
      }
    },
    userOperation: {
      estimateFeesPerGas: async ({ bundlerClient }) => {
        return getUserOperationGasPrice(bundlerClient);
      }
    }
  });

  return { account, kernelClient };
}

// Get smart account address from private key
export async function getSmartAccountAddress(privateKey: `0x${string}`): Promise<string> {
  const { account } = await createSmartAccount(privateKey);
  return account.address;
}

// Send a memo transaction (simple calldata)
export async function sendMemoTransaction(
  privateKey: `0x${string}`,
  memo: string
): Promise<string> {
  const { account, kernelClient } = await createAccountClient(privateKey);

  // Send UserOperation with memo as data to zero address
  const userOpHash = await kernelClient.sendUserOperation({
    callData: await account.encodeCalls([
      {
        to: zeroAddress,
        value: BigInt(0),
        data: memo ? (`0x${Buffer.from(memo).toString('hex')}` as `0x${string}`) : '0x',
      },
    ]),
  });

  // Wait for receipt and return transaction hash
  const receipt = await kernelClient.waitForUserOperationReceipt({
    hash: userOpHash,
  });

  return receipt.receipt.transactionHash;
}

// Get Sepolia Etherscan URL for transaction
export function getEtherscanUrl(txHash: string): string {
  return `https://sepolia.etherscan.io/tx/${txHash}`;
}

// Get Sepolia Etherscan URL for address
export function getEtherscanAddressUrl(address: string): string {
  return `https://sepolia.etherscan.io/address/${address}`;
}

// Check if ZeroDev is configured
export function isZeroDevConfigured(): boolean {
  return !!ZERODEV_PROJECT_ID;
}

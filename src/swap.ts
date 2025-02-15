import { FordefiWeb3Provider, EvmChainId, FordefiProviderConfig } from '@fordefi/web3-provider';
import dotenv from 'dotenv';
import fs from 'fs'

// Load FORDEFI secrets
dotenv.config()
const FORDEFI_API_USER_TOKEN = process.env.FORDEFI_API_USER_TOKEN ?? 
  (() => { throw new Error('FORDEFI_API_USER_TOKEN is not set') })();
const privateKeyFilePath = './fordefi_secret/private.pem';
const PEM_PRIVATE_KEY = fs.readFileSync(privateKeyFilePath, 'utf8') ??
  (() => { throw new Error('PEM_PRIVATE_KEY is not set') })();


// Init Fordefi Provider
const config: FordefiProviderConfig = {
  chainId: EvmChainId.NUMBER_1,
  address: '0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73', // Your Fordefi EVM Vault
  apiUserToken: FORDEFI_API_USER_TOKEN,
  apiPayloadSignKey: PEM_PRIVATE_KEY,
  rpcUrl: "https://ethereum-rpc.publicnode.com",
};
const provider = new FordefiWeb3Provider(config);

// EIP-712 domain data
const domain = {
  name: 'Gnosis Protocol',
  version: 'v2',
  chainId: 1,
  verifyingContract: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41',
};

// Prepare EIP-712 types for the Order struct
const eip712Types = {
  Order: [
    { name: 'sellToken', type: 'address' },
    { name: 'buyToken', type: 'address' },
    { name: 'receiver', type: 'address' },
    { name: 'sellAmount', type: 'uint256' },
    { name: 'buyAmount', type: 'uint256' },
    { name: 'validTo', type: 'uint32' },
    { name: 'appData', type: 'bytes32' },
    { name: 'feeAmount', type: 'uint256' },
    { name: 'kind', type: 'string' },
    { name: 'partiallyFillable', type: 'bool' },
    { name: 'sellTokenBalance', type: 'string' },
    { name: 'buyTokenBalance', type: 'string' },
  ],
};

// Order to sign
const orderMessage = {
  sellToken: '0xc4441c2be5d8fa8126822b9929ca0b81ea0de38e',
  buyToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  receiver: '0xd709Ebc7b8B62C7f554EE5c4872C58280d3F1e40',
  sellAmount: '1000',
  buyAmount: '10',
  validTo: 1739551062,
  appData: '0x0000000000000000000000000000000000000000000000000000000000000000',
  feeAmount: '4003552315949453312',
  kind: 'sell',
  partiallyFillable: false,
  sellTokenBalance: 'erc20',
  buyTokenBalance: 'erc20',
};

// Prepare eth_signTypedData_v4 payload
const typedData = {
  // Domain + types + primaryType -> standard EIP-712 structure
  domain,
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    // Add the “Order” struct to the overall types
    ...eip712Types,
  },
  primaryType: 'Order',
  message: orderMessage,
};

async function main() {
  // Wait for Fordefi provider to connect
  const onConnect = ({ chainId }: any) => {
    console.log(`Connected to chain ${chainId}`);
  }
  const result = await provider.waitForEmittedEvent('connect');
  onConnect(result);

  // Send payload to Fordefi for signing
  const signerAddress = config.address; 
  const signature = await provider.request({
    method: 'eth_signTypedData_v4',
    params: [signerAddress, JSON.stringify(typedData)],
  });

  console.log('Signature:', signature);

  // Rest of the code can broadcast the quote to CowSwap

}

main().catch(console.error);
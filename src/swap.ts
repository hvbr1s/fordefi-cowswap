import { FordefiWeb3Provider, EvmChainId, FordefiProviderConfig } from '@fordefi/web3-provider';
import { OrderBookApi, SupportedChainId, OrderQuoteRequest, OrderQuoteSideKindSell } from '@cowprotocol/cow-sdk'
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

const quoteRequest: OrderQuoteRequest = {
  sellToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
  buyToken: '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
  from: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
  receiver: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
  sellAmountBeforeFee: (100000 * 10 ** 6).toString(),
  kind: OrderQuoteSideKindSell.SELL,
}

// Prepare eth_signTypedData_v4 payload
function prepareOrderTypedData(quote: any) {
  return {
    domain,
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      ...eip712Types,
    },
    primaryType: 'Order',
    message: quote,
  };
}

const orderBookApi = new OrderBookApi({ chainId: SupportedChainId.MAINNET })

async function main() {
  // Wait for Fordefi provider to connect
  const onConnect = ({ chainId }: any) => {
    console.log(`Connected to chain ${chainId}`);
  }
  const result = await provider.waitForEmittedEvent('connect');
  onConnect(result);

  // Request quote
  const { quote } = await orderBookApi.getQuote(quoteRequest)
  console.log(quote)

  // Send payload to Fordefi for signing
  const signerAddress = config.address; 
  const typedData = prepareOrderTypedData(quote);
  const signature = await provider.request({
    method: 'eth_signTypedData_v4',
    params: [signerAddress, JSON.stringify(typedData)],
  });
  console.log('Signature:', signature);


}

main().catch(console.error);
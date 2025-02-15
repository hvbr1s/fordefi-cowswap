import { FordefiWeb3Provider, EvmChainId, FordefiProviderConfig } from '@fordefi/web3-provider';
import { OrderBookApi, OrderSigningUtils, SupportedChainId, OrderQuoteRequest, OrderQuoteSideKindSell, SigningScheme } from '@cowprotocol/cow-sdk'
import { ethers } from 'ethers';
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
  sellToken: '0xC4441c2BE5d8fA8126822B9929CA0b81Ea0DE38E', // USUAL
  buyToken: '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
  from: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
  receiver: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
  sellAmountBeforeFee: (100000 * 18 ** 6).toString(),
  kind: OrderQuoteSideKindSell.SELL,
  signingScheme: SigningScheme.EIP712
}

// Prepare eth_signTypedData_v4 payload
function prepareOrderTypedData(quote: any) {
  return {
    domain,
    types: {
      Order: eip712Types.Order
    },
    message: quote,
  };
}

const orderBookApi = new OrderBookApi({ chainId: SupportedChainId.MAINNET })
const fordefiProvider = new FordefiWeb3Provider({
  address: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
  apiUserToken: FORDEFI_API_USER_TOKEN,
  apiPayloadSignKey: PEM_PRIVATE_KEY,
  chainId: EvmChainId.NUMBER_1, // Mainnet
  rpcUrl: "https://ethereum-rpc.publicnode.com",
});
const provider = new ethers.providers.Web3Provider(fordefiProvider)
console.log(provider)

async function main() {
  // Request quote
  const { quote } = await orderBookApi.getQuote(quoteRequest)
  console.log(quote)
  
  const signer = provider.getSigner();
  const unsignedOrder = {
    ...quote,
    receiver: quote.receiver || config.address, 
  };
  
  const orderSigningResult = await OrderSigningUtils.signOrder(unsignedOrder, domain.chainId, signer);
  console.log(orderSigningResult)
  
  const orderCreation = {
    ...quote,
    signature: orderSigningResult.signature,
    signingScheme: orderSigningResult.signingScheme as unknown as SigningScheme,
  };
  console.log(orderCreation)
  
  const orderId = await orderBookApi.sendOrder(orderCreation);
  const order = await orderBookApi.getOrder(orderId)
  console.log(order)
}

main().catch(console.error);
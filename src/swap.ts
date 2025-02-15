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
  address: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
  apiUserToken: FORDEFI_API_USER_TOKEN,
  apiPayloadSignKey: PEM_PRIVATE_KEY,
  chainId: EvmChainId.NUMBER_1, // Mainnet
  rpcUrl: "https://ethereum-rpc.publicnode.com",
};
const fordefiProvider = new FordefiWeb3Provider(config);
const provider = new ethers.providers.Web3Provider(fordefiProvider)

// Prepare CowSwap quote
const quoteRequest: OrderQuoteRequest = {
  sellToken: '0xC4441c2BE5d8fA8126822B9929CA0b81Ea0DE38E', // USUAL
  buyToken: '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
  from: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
  receiver: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
  sellAmountBeforeFee: (1000000000000 * 18 ** 6).toString(),
  kind: OrderQuoteSideKindSell.SELL,
  signingScheme: SigningScheme.EIP712
}

const orderBookApi = new OrderBookApi({ chainId: SupportedChainId.MAINNET })

async function main() {
  // Request quote
  const { quote } = await orderBookApi.getQuote(quoteRequest)
  console.log(quote)
  
  const signer = provider.getSigner();
  const unsignedOrder = {
    ...quote,
    receiver: quote.receiver || config.address, 
  };
  
  const orderSigningResult = await OrderSigningUtils.signOrder(unsignedOrder, SupportedChainId.MAINNET, signer);
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
/*
  Adapter library for working with a wallet.
*/

// Public npm libraries
const BchWallet = require('minimal-slp-wallet/index')

// Local libraries
const JsonFiles = require('./json-files')

const WALLET_FILE = `${__dirname.toString()}/../../wallet.json`
const PROOF_OF_BURN_QTY = 0.01
const P2WDB_TOKEN_ID =
  '38e97c5d7d3585a2cbf3f9580c82ca33985f9cb0845d4dcce220cb709f9538b0'

class WalletAdapter {
  constructor (localConfig = {}) {
    // Encapsulate dependencies
    this.jsonFiles = new JsonFiles()
    this.WALLET_FILE = WALLET_FILE
    this.BchWallet = BchWallet
  }

  // Open the wallet file, or create one if the file doesn't exist.
  async openWallet () {
    try {
      let walletData

      // Try to open the wallet.json file.
      try {
        // console.log('this.WALLET_FILE: ', this.WALLET_FILE)
        walletData = await this.jsonFiles.readJSON(this.WALLET_FILE)
      } catch (err) {
        // Create a new wallet file if one does not already exist.
        // console.log('caught: ', err)
        console.warn('Wallet file not found. Creating new wallet.json file.')

        // Create a new wallet.
        // No-Update flag creates wallet without making any network calls.
        const walletInstance = new this.BchWallet(undefined, { noUpdate: true })

        // Wait for wallet to initialize.
        await walletInstance.walletInfoPromise

        walletData = walletInstance.walletInfo

        // Write the wallet data to the JSON file.
        await this.jsonFiles.writeJSON(walletData, this.WALLET_FILE)
      }

      // console.log('walletData: ', walletData)

      return walletData
    } catch (err) {
      console.error('Error in openWallet()')
      throw err
    }
  }

  // Create an instance of minimal-slp-wallet. Use data in the wallet.json file,
  // and pass the bch-js information to the minimal-slp-wallet library.
  async instanceWallet (walletData, bchjs) {
    try {
      // TODO: Throw error if bch-js is not passed in.
      // TODO: throw error if wallet data is not passed in.

      const advancedConfig = {
        restURL: bchjs.restURL,
        apiToken: bchjs.apiToken
      }

      // Instantiate minimal-slp-wallet.
      this.bchWallet = new this.BchWallet(walletData.mnemonic, advancedConfig)

      // Wait for wallet to initialize.
      await this.bchWallet.walletInfoPromise

      return true
    } catch (err) {
      console.error('Error in instanceWallet()')
      throw err
    }
  }

  // Generate a cryptographic signature, required to write to the P2WDB.
  async generateSignature (message) {
    try {
      // TODO: Add input validation for message.

      const privKey = this.bchWallet.walletInfo.privateKey

      // console.log('privKey: ', privKey)
      // console.log('flags.data: ', flags.data)

      const signature = this.bchWallet.bchjs.BitcoinCash.signMessageWithPrivKey(
        privKey,
        message
      )

      return signature
    } catch (err) {
      console.error('Error in generateSignature()')
      throw err
    }
  }

  // Burn enough PSF to generate a valide proof-of-burn for writing to the P2WDB.
  async burnPsf () {
    try {
      // TODO: Throw error if this.bchWallet has not been instantiated.

      // console.log('walletData: ', walletData)
      // console.log(
      //   `walletData.utxos.utxoStore.slpUtxos: ${JSON.stringify(
      //     walletData.utxos.utxoStore.slpUtxos,
      //     null,
      //     2,
      //   )}`,
      // )

      // Get token UTXOs held by the wallet.
      const tokenUtxos = this.bchWallet.utxos.utxoStore.slpUtxos.type1.tokens

      // Find a token UTXO that contains PSF with a quantity higher than needed
      // to generate a proof-of-burn.
      let tokenUtxo = {}
      for (let i = 0; i < tokenUtxos.length; i++) {
        const thisUtxo = tokenUtxos[i]

        // If token ID matches.
        if (thisUtxo.tokenId === P2WDB_TOKEN_ID) {
          if (parseFloat(thisUtxo.tokenQty) >= PROOF_OF_BURN_QTY) {
            tokenUtxo = thisUtxo
            break
          }
        }
      }

      if (tokenUtxo.tokenId !== P2WDB_TOKEN_ID) {
        throw new Error(
          `Token UTXO of with ID of ${P2WDB_TOKEN_ID} and quantity greater than ${PROOF_OF_BURN_QTY} could not be found in wallet.`
        )
      }

      const result = await this.bchWallet.burnTokens(
        PROOF_OF_BURN_QTY,
        P2WDB_TOKEN_ID
      )
      // console.log('walletData.burnTokens() result: ', result)

      return result

      // return {
      //   success: true,
      //   txid: 'fakeTxid',
      // }
    } catch (err) {
      console.error('Error in burnPsf(): ', err)
      throw err
    }
  }
}

module.exports = WalletAdapter

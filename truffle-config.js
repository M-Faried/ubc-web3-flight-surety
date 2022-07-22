const { INFURA_NETWORK_ID, WALLET_MNEOMONIC } = require('./secrets.js');
var HDWalletProvider = require("truffle-hdwallet-provider");

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 7545,
      network_id: '5777',
    },
    ropsten: {
      provider: () => new HDWalletProvider(WALLET_MNEOMONIC, `https://ropsten.infura.io/v3/${INFURA_NETWORK_ID}`),
      network_id: 3,       // rinkeby's id
      gas: 4500000,        // rinkeby has a lower block limit than mainnet
      gasPrice: 10000000000
    },
  },
  compilers: {
    solc: {
      version: "^0.4.26"
    }
  }
};
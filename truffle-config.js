const { INFURA_NETWORK_ID, WALLET_MNEOMONIC } = require('./secrets.js');
var HDWalletProvider = require("truffle-hdwallet-provider");

module.exports = {
  networks: {
    development: {
      // provider: function () {
      //   return new HDWalletProvider(mnemonic, "http://127.0.0.1:7545/", 0, 30);
      // },
      host: "localhost",
      port: 7545,
      network_id: '5777',
      // gas: 4500000,
      // gasPrice: 10000000000
      // host: "localhost",
      // port: 9545,
      // network_id: "5777"
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
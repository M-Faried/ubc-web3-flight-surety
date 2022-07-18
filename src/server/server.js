import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';
import { Random } from "random-js";


const ORACLES_COUNT = 3;
let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];


let _flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
let _oracles = [];

const registerOracles = async () => {
  try {
    // Retrieving all the accounts.
    const accounts = await web3.eth.getAccounts();
    const registrationFees = web3.utils.toWei("1", "ether");

    // Dedicating the last 3 accounts of ganache to the oracle.
    const oracleAccounts = accounts.slice(accounts.length - ORACLES_COUNT);

    for (let i = 0; i < ORACLES_COUNT; i++) {
      // Registering the oracle.
      await _flightSuretyApp.registerOracle({ from: oracleAccounts[i], value: registrationFees });
      // Fetching the index of the oracle.
      let index = await _flightSuretyApp.getMyIndexes({ from: oracleAccounts[i] });
      // Adding the oracle account to the list of the oracles.
      _oracles.push({
        index,
        account: oracleAccounts[i]
      });
    }

    console.log('The oracle was registred successfully.');
  }
  catch (e) {
    console.log('Unable to register the oracle.');
  }
}

registerOracles();

_flightSuretyApp.events.OracleRequest({
  fromBlock: 0
}, function (error, event) {
  if (error) {
    console.log("Oracle Error:", error);
  } else {

    console.log("Oracle Request:", event);

    let requestFlight = event.returnValues;
    const random = new Random();
    let statusCode = Math.ceil((random.integer(1, 50)) / 10) * 10; // Generating random status

    // console.log(`Oracle Received Request: ID ${requestFlight.flight} Airline ${requestFlight.airline} sent status ${statusCode}`);    

    for (let i = 0; i < ORACLES_COUNT; i++) {
      _flightSuretyApp.submitOracleResponse(
        _oracles[i].index,
        requestFlight.airline,
        requestFlight.flight,
        requestFlight.timestamp,
        statusCode,
        { from: _oracles[i].account }
      ).then(res => {
        console.log(`Flight status was submitted successfully. STATUS: ${statusCode} INDEX: ${_oracles[i].index}`);
      }).catch(err => {
        console.log(`Failed to submit oracle request. INDEX: ${_oracles[i].index}`, err);
      });
    }

  }
});


const app = express();

app.get('/api', (req, res) => {
  res.send({
    message: 'An API for use with your Dapp!'
  })
})

export default app;



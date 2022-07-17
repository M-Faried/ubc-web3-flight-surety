import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';
import { Random } from "random-js";


let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];


let _flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
let _oracle = {};

const registerOracle = async () => {
  try {
    // Retrieving all the accounts.
    const accounts = await web3.eth.getAccounts();
    // Dedicating the last account of ganache to the oracle.
    const oracleAccount = accounts[accounts.length - 1];
    const registrationFees = web3.utils.toWei("1", "ether");
    await _flightSuretyApp.registerOracle({ from: oracleAccount, value: registrationFees });
    let index = await _flightSuretyApp.getMyIndexes({ from: oracleAccount });
    _oracle = {
      index,
      account: oracleAccount
    };
    console.log('The oracle was registred successfully.');
  }
  catch (e) {
    console.log('Unable to register the oracle.');
  }
}

registerOracle();

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

    _flightSuretyApp.submitOracleResponse(
      _oracle.index,
      requestFlight.airline,
      requestFlight.flight,
      requestFlight.timestamp,
      statusCode,
      { from: _oracle.account }
    ).then(res => {
      console.log(`Flight status was submitted successfully. STATUS: ${statusCode}`);
    }).catch(err => {
      console.log("Failed to submit oracle request.", err);
    });

  }
});


const app = express();

app.get('/api', (req, res) => {
  res.send({
    message: 'An API for use with your Dapp!'
  })
})

export default app;



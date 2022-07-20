import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network, callback) {

        let config = Config[network];
        this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.initialize(callback);
        this.currentAccount = null;
        this.airlines = [];
        this.passengers = [];
    }

    initialize(callback) {
        this.web3.eth.getAccounts((error, accts) => {

            this.currentAccount = accts[0];
            console.log('Here are all the accounts:', accts);

            // let counter = 1;

            // while (this.airlines.length < 5) {
            //     this.airlines.push(accts[counter++]);
            // }

            // while (this.passengers.length < 5) {
            //     this.passengers.push(accts[counter++]);
            // }

            callback();
        });
    }

    isOperational(callback) {
        let self = this;
        self.flightSuretyApp.methods
            .isOperational()
            .call({ from: self.currentAccount }, callback);
    }

    fetchFlightStatus(airline, flight, timestamp, callback) {
        let self = this;
        self.flightSuretyApp.methods
            .fetchFlightStatus(airline, flight, timestamp)
            .send({ from: self.currentAccount }, (error, result) => {
                callback(error);
            });
    }

    registerAirline(airline) {
        let self = this;
        self.flightSuretyApp.registerAirline(airline)
            .send({ from: airline }, (error, result) => {
                self.airlines.push(airline);
                callback(error, result);
            })
    }

    payRegistrationFee(airline, fees) {
        let self = this;
        self.flightSuretyApp.payRegistrationFee()
            .send({ from: airline, value: this.web3.utils.fromWei(fees, "ether") }, (error, result) => {
                callback(error, result);
            })
    }

    registerFlight(airline, flightId, timestamp) {
        let self = this;
        self.flightSuretyApp.registerFlight(flightId, timestamp)
            .send({ from: airline }, (error, result) => {
                callback(error, result);
            })
    }

    buy(airline, flightId, timeStamp, passenger, insuranceAmmount) {
        let self = this;
        self.flightSuretyApp.buy(airline, flightId, timeStamp)
            .send({ from: passenger, value: insuranceAmmount }, (error, result) => {
                callback(error, result);
            })
    }

    creditInsurees() {
        let self = this;
        self.flightSuretyApp.creditInsurees()
            .send({ from: self.currentAccount }, (error, result) => {
                callback(error, result);
            })
    }

    fund() {
        let self = this;
        self.flightSuretyApp.fund()
            .send({ from: self.currentAccount }, (error, result) => {
                callback(error, result);
            })
    }

}

var FlightSuretyApp = artifacts.require("FlightSuretyApp");
var FlightSuretyData = artifacts.require("FlightSuretyData");
var BigNumber = require('bignumber.js');

var Config = async function (accounts) {
    // console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>Test Config Accounts');
    // console.log(accounts);

    // These test addresses are useful when you need to add
    // multiple users in test scripts
    // let testAddresses = [
    //     "0x69e1CB5cFcA8A311586e3406ed0301C06fb839a2",
    //     "0xF014343BDFFbED8660A9d8721deC985126f189F3",
    //     "0x0E79EDbD6A727CfeE09A2b1d0A59F7752d5bf7C9",
    //     "0x9bC1169Ca09555bf2721A5C9eC6D69c8073bfeB4",
    //     "0xa23eAEf02F9E0338EEcDa8Fdd0A73aDD781b2A86",
    //     "0x6b85cc8f612d5457d49775439335f83e12b8cfde",
    //     "0xcbd22ff1ded1423fbc24a7af2148745878800024",
    //     "0xc257274276a4e539741ca11b590b9447b26a8051",
    //     "0x2f2899d6d35b1a48a4fbdc93a37a72f264a9fca7"
    // ];

    // let testAddresses = [
    //     "0x9B3f891A30b60C05bAb8F7F98A38C6B1E6885B76",
    //     "0x20Ec98eF5E7992dD5EfdbA8526f851b3Dd796422",
    //     "0xf20E7E2e194d30085e43631a376bbB1C40B19770",
    //     "0x4f8494F7Eb343cd5bDA68150E596F171768946E6",
    //     "0xAA6bE1Fb9c65111E7365440e9149804cc85F554f",
    //     "0xd4F5f91D1f07538e420cbF1b58a18B1e6b9aA91B",
    //     "0x861a9781FD844Df2eF7C6942c8d08DCe86E1F4e8",
    //     "0x2e1d3F0B173F36BB731b33621086AE805af6Db9f",
    //     "0xB426d52FF6cE764FAb31004D490FA81A857f1dcB",
    //     "0x95DfEA08e8ad507e0Df3E57926abed765f07CF0B",
    // ];


    let owner = accounts[0];
    let firstAirline = accounts[1];
    let testAddresses = accounts.slice(2);

    let flightSuretyData = await FlightSuretyData.new(firstAirline, { from: owner });
    let flightSuretyApp = await FlightSuretyApp.new(flightSuretyData.address, { from: owner });


    return {
        owner: owner,
        firstAirline: firstAirline,
        weiMultiple: (new BigNumber(10)).pow(18),
        testAddresses: testAddresses,
        flightSuretyData: flightSuretyData,
        flightSuretyApp: flightSuretyApp
    }
}

module.exports = {
    Config: Config
};
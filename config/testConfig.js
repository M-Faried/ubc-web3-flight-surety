
var FlightSuretyApp = artifacts.require("FlightSuretyApp");
var FlightSuretyData = artifacts.require("FlightSuretyData");
var BigNumber = require('bignumber.js');

var Config = async function (accounts) {

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

    let testAddresses = [
        "0x7dbeef232a64ec5a96b65f2cc32c7aceeb31e80c",
        "0x157f57e4a6d1886af4065859319fba08a6340278",
        "0xbacbce688a6ad9f2203819a18f8f6a5d6ad7c946",
        "0xdb783458c2eb0dee8dd0792e3245e6e159846186",
        "0xfc32f1b6653913c9d0a5a2afba65fcd8d0781121",
        "0x2b5a206fe6d619d07c8749dffbe068f8fc12061a",
        "0xfe4bf2a585b1f8a97d869fc384ca9589ea965905",
        "0xd634117f9ab82b02665edebc65a055d4dfb00b95",
        "0x45aec21c996ab4309367461d648c8d3fb4e2b69c",
        "0x942358d61b5c8b0922e25ada47f351cc60ef218d"
    ];


    let owner = accounts[0];
    let firstAirline = accounts[1];

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
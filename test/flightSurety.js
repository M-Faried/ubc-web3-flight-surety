
var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');
var web3 = require('web3');

contract('Flight Surety Tests', async (accounts) => {

    var config;

    before('setup contract', async () => {
        config = await Test.Config(accounts);
        await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
    });

    /****************************************************************************************/
    /* Operations and Settings                                                              */
    /****************************************************************************************/

    it(`(operational) has correct initial isOperational() value`, async function () {

        // Get operating status
        let status = await config.flightSuretyData.isOperational();
        assert.equal(status, true, "Incorrect initial operating status value");

    });

    it(`(operational) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

        // Ensure that access is denied for non-Contract Owner account
        let accessDenied = false;
        try {
            await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
        }
        catch (e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
    });

    it(`(operational) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

        // Ensure that access is allowed for Contract Owner account
        let accessDenied = false;
        try {
            await config.flightSuretyData.setOperatingStatus(false, { from: config.owner });
        }
        catch (e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
        await config.flightSuretyData.setOperatingStatus(true, { from: config.owner });
    });

    it(`(operational) can block access to functions using requireIsOperational when operating status is false`, async function () {

        await config.flightSuretyData.setOperatingStatus(false, { from: config.owner });

        let reverted = false;
        try {
            await config.flightSuretyData.payRegistrationFee({ from: config.owner, value: web3.utils.toWei("1", "ether") });
        }
        catch (e) {
            reverted = true;
        }

        assert.equal(reverted, true, "Access not blocked for requireIsOperational");

        // Set it back for other tests to work
        await config.flightSuretyData.setOperatingStatus(true, { from: config.owner });

    });

    it('(airline) cannot add an airline directly from EVEN by the owner', async () => {
        let newAirline = config.testAddresses[2];
        try {
            await config.flightSuretyData.addAirline(newAirline, { from: config.owner });
        }
        catch (e) {
            // console.log(e.message);
        }
        let airlineAdded = await config.flightSuretyData.isAirline(newAirline);
        assert.equal(airlineAdded, false, "Airline can't be registred using the data contract add airline");
    });

    it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {

        // ARRANGE
        let newAirline = config.testAddresses[2];

        // ACT
        try {
            await config.flightSuretyApp.registerAirline(newAirline, { from: config.firstAirline });
        }
        catch (e) {

        }

        let result = await config.flightSuretyData.isAirline(newAirline);

        // ASSERT
        assert.equal(result, false, "Airline should not be able to register another airline if it hasn't provided funding");

    });


    it("(airline) does NOT register if it pays insuffecient funds", async () => {

        let fees = web3.utils.toWei("0.5", "ether");
        let newAirline = config.testAddresses[2];

        try {
            await config.flightSuretyApp.payRegistrationFee({ from: newAirline, value: fees });
        }
        catch (e) {

        }
        let registred = await config.flightSuretyData.isAirline(newAirline);
        assert.equal(registred, false, "Airline shouldn't be registred without paying the full fees");
    });


    it('(airline) registres the air line when it pays sufficient funds', async () => {

        let fees = web3.utils.toWei("10", "ether");
        let newAirline = config.testAddresses[2];

        try {
            await config.flightSuretyApp.payRegistrationFee({ from: newAirline, value: fees });
        }
        catch (e) {

        }

        let registred = await config.flightSuretyData.isAirline(newAirline);
        assert.equal(registred, true, "Airline should be registred after paying the full fees, and being approved by another existing airline.");
    });

    it("(airline) airlines can NOT pay the fees twice.", async () => {

        let fees = web3.utils.toWei("10", "ether");
        let newAirline = config.testAddresses[9];

        await config.flightSuretyApp.payRegistrationFee({ from: newAirline, value: fees });

        let paymentDenied = false;
        try {
            await config.flightSuretyApp.payRegistrationFee({ from: newAirline, value: fees });
        }
        catch (e) {
            paymentDenied = true
        }
        assert.equal(paymentDenied, true, "Airline should not be able to pay the fees twice.");
    });

    it('(access control) ensures that authorized contracts can access the number of registred airlines', async () => {

        let accessDenied = false;
        let length = 0;
        try {
            length = await config.flightSuretyData.getAirlinesCount({ from: config.flightSuretyApp.address });
        }
        catch (e) {
            accessDenied = true;
        }

        assert.equal(accessDenied, false, "No body can access the count of registred airlines except registred contracts");
        assert.equal(length.toNumber(), 2, "The number of registred flights is not suitable for the following test cases.");
    });


    it("(multiparty) ensures multiparty consensys becomes effective when the already registred airlines reaches 4", async () => {

        let fees = web3.utils.toWei("10", "ether");

        // Registering 3 more lines to the two that they were added before
        await config.flightSuretyApp.registerAirline(config.testAddresses[3], { from: config.firstAirline });
        await config.flightSuretyApp.registerAirline(config.testAddresses[4], { from: config.firstAirline });
        await config.flightSuretyApp.registerAirline(config.testAddresses[5], { from: config.firstAirline });

        await config.flightSuretyApp.payRegistrationFee({ from: config.testAddresses[4], value: fees });
        await config.flightSuretyApp.payRegistrationFee({ from: config.testAddresses[3], value: fees });

        // Paying fees for the following shouldn't lead to registration as we now have 4 airlines.
        await config.flightSuretyApp.payRegistrationFee({ from: config.testAddresses[5], value: fees });

        let airlinesCount = await config.flightSuretyData.getAirlinesCount({ from: config.flightSuretyApp.address });
        let addedLastAirline = await config.flightSuretyData.isAirline(config.testAddresses[5]);

        assert.equal(airlinesCount.toNumber(), 4, "The airlines count is not correct.");
        assert.equal(addedLastAirline, false, "The last airline shouldn't be added before consensys happen");

    });


    it("(multiparty) ensures multiparty consensys is working correctly.", async () => {

        // As fee is paid and we already have a confirmation from the first airline, all we missing for registration 
        // is another registration request to complete registration.

        await config.flightSuretyApp.registerAirline(config.testAddresses[5], { from: config.testAddresses[3] });


        let airlinesCount = await config.flightSuretyData.getAirlinesCount({ from: config.flightSuretyApp.address });
        let addedLastAirline = await config.flightSuretyData.isAirline(config.testAddresses[5]);

        assert.equal(airlinesCount.toNumber(), 5, "The airlines count is not correct.");
        assert.equal(addedLastAirline, true, "The last airline shouldn't be added before consensys happen");

    });

    it("(multiparty) ensures multiparty consensys is working correctly.", async () => {

        let fees = web3.utils.toWei("10", "ether");
        let newAddress = config.testAddresses[6];

        await config.flightSuretyApp.payRegistrationFee({ from: newAddress, value: fees });
        await config.flightSuretyApp.registerAirline(newAddress, { from: config.testAddresses[4] });
        await config.flightSuretyApp.registerAirline(newAddress, { from: config.testAddresses[2] });

        let airlinesCount = await config.flightSuretyData.getAirlinesCount({ from: config.flightSuretyApp.address });
        let addedLastAirline = await config.flightSuretyData.isAirline(newAddress);

        assert.equal(airlinesCount.toNumber(), 6, "The airlines count is not correct.");
        assert.equal(addedLastAirline, true, "The last airline shouldn't be added before consensys happen");
    });

    it("(multiparty) ensures multiparty consensys is working correctly and requires half of the number of approvals.", async () => {

        let fees = web3.utils.toWei("10", "ether");
        let newAddress = config.testAddresses[7];

        await config.flightSuretyApp.payRegistrationFee({ from: newAddress, value: fees });
        await config.flightSuretyApp.registerAirline(newAddress, { from: config.testAddresses[5] });
        await config.flightSuretyApp.registerAirline(newAddress, { from: config.testAddresses[6] });
        await config.flightSuretyApp.registerAirline(newAddress, { from: config.testAddresses[2] });

        let airlinesCount = await config.flightSuretyData.getAirlinesCount({ from: config.flightSuretyApp.address });
        let addedLastAirline = await config.flightSuretyData.isAirline(newAddress);

        assert.equal(airlinesCount.toNumber(), 7, "The airlines count is not correct.");
        assert.equal(addedLastAirline, true, "The last airline shouldn't be added before consensys happen");
    });

});

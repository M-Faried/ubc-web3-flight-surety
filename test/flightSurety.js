
var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');
var web3 = require('web3');
const { IgnorePlugin } = require('webpack');

contract('Flight Surety Tests', async (accounts) => {

    const flight = {
        id: 'ND1309', // Course number
        timestamp: Math.floor(Date.now() / 1000), // Timestamp.        
    }

    const STATUS_CODE_UNKNOWN = 0;
    const STATUS_CODE_ON_TIME = 10;
    const STATUS_CODE_LATE_AIRLINE = 20;
    const STATUS_CODE_LATE_WEATHER = 30;
    const STATUS_CODE_LATE_TECHNICAL = 40;
    const STATUS_CODE_LATE_OTHER = 50;

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
        let balanceBefore = await config.flightSuretyApp.getCurrentBalance({ from: config.owner });

        let newAirline = config.testAddresses[2];

        try {
            await config.flightSuretyApp.payRegistrationFee({ from: newAirline, value: fees });
        }
        catch (e) {

        }
        let registred = await config.flightSuretyData.isAirline(newAirline);
        let balanceAfter = await config.flightSuretyApp.getCurrentBalance({ from: config.owner });
        assert.equal(registred, false, "Airline shouldn't be registred without paying the full fees");
        assert.equal(`${balanceBefore}`, `${balanceAfter}`, "The balance should remain the same");
    });


    it('(airline) registres the air line when it pays sufficient funds', async () => {

        let fees = web3.utils.toWei("10", "ether");
        let newAirline = config.testAddresses[2];
        let balanceBefore = await config.flightSuretyApp.getCurrentBalance({ from: config.owner });

        try {
            await config.flightSuretyApp.payRegistrationFee({ from: newAirline, value: fees });
        }
        catch (e) {

        }

        let registred = await config.flightSuretyData.isAirline(newAirline);

        // Checking the balance after the operation.
        let balanceAfter = await config.flightSuretyApp.getCurrentBalance({ from: config.owner });
        balanceAfter = web3.utils.fromWei(`${balanceAfter}`, "ether");
        let expectedBalance = web3.utils.fromWei(`${balanceBefore + fees}`, "ether");

        assert.equal(registred, true, "Airline should be registred after paying the full fees, and being approved by another existing airline.");
        assert.equal(`${balanceAfter}`, `${expectedBalance}`, "The balance should be updated.");

    });

    it("(airline) airlines can NOT pay the fees twice", async () => {

        let fees = web3.utils.toWei("10", "ether");
        let newAirline = config.testAddresses[9];

        // Paying the fees for the airline.
        await config.flightSuretyApp.payRegistrationFee({ from: newAirline, value: fees });

        // Trying to pay the fees again.
        let balanceBefore = await config.flightSuretyApp.getCurrentBalance({ from: config.owner });
        let paymentDenied = false;
        try {
            await config.flightSuretyApp.payRegistrationFee({ from: newAirline, value: fees });
        }
        catch (e) {
            paymentDenied = true
        }

        // Checking the balance after the operation.
        let balanceAfter = await config.flightSuretyApp.getCurrentBalance({ from: config.owner });
        assert.equal(paymentDenied, true, "Airline should not be able to pay the fees twice.");
        assert.equal(`${balanceBefore}`, `${balanceAfter}`, "The balance should remain the same when the payment is rejected");
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


    it("(multiparty) ensures multiparty consensys is working correctly", async () => {

        // As fee is paid and we already have a confirmation from the first airline, all we missing for registration 
        // is another registration request to complete registration.

        await config.flightSuretyApp.registerAirline(config.testAddresses[5], { from: config.testAddresses[3] });


        let airlinesCount = await config.flightSuretyData.getAirlinesCount({ from: config.flightSuretyApp.address });
        let addedLastAirline = await config.flightSuretyData.isAirline(config.testAddresses[5]);

        assert.equal(airlinesCount.toNumber(), 5, "The airlines count is not correct.");
        assert.equal(addedLastAirline, true, "The last airline shouldn't be added before consensys happen");

    });

    it("(multiparty) ensures multiparty consensys is working correctly", async () => {

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

    it("(multiparty) ensures multiparty consensys is working correctly and requires half of the number of approvals", async () => {

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

    it("(flight) flight can be registred successfully by a registred airline", async () => {
        await config.flightSuretyApp.registerFlight(flight.id, flight.timestamp, { from: config.firstAirline });
        let registered = await config.flightSuretyApp.isFlight(config.firstAirline, flight.id, flight.timestamp, { from: config.owner });
        assert.equal(registered, true, "The flight was not registered successfully");
    });

    it("(flight) flight can NOT be registred by a non registred airline", async () => {
        let declined = false;
        try {
            await config.flightSuretyApp.registerFlight(flight.id, flight.timestamp, { from: config.testAddresses[15] });
        }
        catch (e) {
            declined = true;
        }
        let registered = await config.flightSuretyApp.isFlight(config.testAddresses[15], flight.id, flight.timestamp, { from: config.owner });
        assert.equal(declined, true, "Flight registration by a non registred airline is allowed");
        assert.equal(registered, false, "The is registred while it shouldn't");
    });

    it("(flight) doesn't allow users to buy insurance for nonexistant flights", async () => {
        let fees = web3.utils.toWei("1", "ether");
        let customer = config.testAddresses[20];
        let unregistredFlight = config.testAddresses[11];
        let declined = false;
        try {
            await config.flightSuretyApp.buy(unregistredFlight, flight.id, fligh.timestamp, { from: customer, value: fees });
        }
        catch (e) {
            declined = true;
        }
        assert.equal(declined, true, "A customer was able to purchase insurance for non existing flight");
    });

    it("(flight) doesn't allow users to buy insurance for less than 1 ether", async () => {
        let fees = web3.utils.toWei("1.5", "ether");
        let customer = config.testAddresses[20];
        let declined = false;
        try {
            await config.flightSuretyApp.buy(config.firstAirline, flight.id, fligh.timestamp, { from: customer, value: fees });
        }
        catch (e) {
            declined = true;
        }
        assert.equal(declined, true, "A customer was able to purchase insurance for less than one ether");
    });

    it("(flight) allows customer to buy insurance for a flight", async () => {
        let insurancePayment = web3.utils.toWei("0.5", "ether");
        let customer = config.testAddresses[20];

        let balanceBefore = await config.flightSuretyApp.getCurrentBalance({ from: config.owner });
        await config.flightSuretyApp.buy(config.firstAirline, flight.id, flight.timestamp, { from: customer, value: insurancePayment });

        let payment = await config.flightSuretyApp.getInsurancePayment(customer, { from: config.owner });
        let balanceAfter = await config.flightSuretyApp.getCurrentBalance({ from: config.owner });
        let expected = web3.utils.fromWei(`${balanceAfter - balanceBefore}`, "ether")

        assert.equal(payment, insurancePayment, "The customer wasn't able to purchace ");
        assert.equal(expected, web3.utils.fromWei(`${insurancePayment}`, "ether"), "The balance is not updates");
    });

    it("(flight oracle) Fetching flight status oracle request event is triggered", async () => {
        let eventTriggered = false;
        config.flightSuretyApp.OracleRequest(null, () => {
            eventTriggered = true;
        });
        await config.flightSuretyApp.fetchFlightStatus(config.firstAirline, flight.id, flight.timestamp);
        assert.equal(eventTriggered, true, "The event was not triggered");
    });

    it("(flight oracle) can update the flight status correctly", async () => {
        let writeStatus = STATUS_CODE_LATE_WEATHER;
        await config.flightSuretyApp.processFlightStatus(config.firstAirline, flight.id, flight.timestamp, writeStatus);
        let readStatus = await config.flightSuretyApp.getFlightStatus(config.firstAirline, flight.id, flight.timestamp, { from: config.owner });
        assert.equal(writeStatus, readStatus, "Flight status is not set correctly");
    });

    it("(flight oracle) can credit the balance of the insuree correctly", async () => {
        // These values are the values of a customer from a previous test.
        let customer = config.testAddresses[20];
        let customerPayment = web3.utils.toWei("0.5", "ether");
        let expectedPayment = customerPayment * 1.5;

        // calling credit insurees.
        await config.flightSuretyApp.creditInsurees({ from: config.owner });
        let payment = await config.flightSuretyApp.getInsurancePayment(customer, { from: config.owner });

        // Checking the value as expected.
        assert.equal(`${payment}`, `${expectedPayment}`, "The credit value of the insuree wasn't increased correctly");
    });

    it("(flight) does NOT increase the credit value for ON_TIME flights insurees", async () => {
        let insurancePayment = web3.utils.toWei("0.7", "ether");
        let customer = config.testAddresses[21];

        let airline = config.testAddresses[7];
        let timestamp = Math.floor(Date.now() / 1000); // Timestamp.
        let flightId = "ND0002";

        // Registering the flight.
        await config.flightSuretyApp.registerFlight(flightId, timestamp, { from: airline });
        // Buying insurance by the customer.
        await config.flightSuretyApp.buy(airline, flightId, timestamp, { from: customer, value: insurancePayment });
        // Updating the flight status.
        await config.flightSuretyApp.processFlightStatus(airline, flightId, timestamp, STATUS_CODE_ON_TIME);
        // Updating insurees balance.
        await config.flightSuretyApp.creditInsurees({ from: config.owner });
        // Checking the balance of the customer.
        let payment = await config.flightSuretyApp.getInsurancePayment(customer, { from: config.owner });
        assert.equal(`${payment}`, `${insurancePayment}`, "The credit value of the insuree has increased while it shouldn't");
    });







});

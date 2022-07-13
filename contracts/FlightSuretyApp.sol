pragma solidity ^0.4.25;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    uint8 private constant MIN_AIRLINES_BEFORE_CONSENSYS = 4;
    uint256 private constant REQUIRED_REGISTRATION_FEE = 10 ether;
    uint256 private constant INSURANCE_FEES_MAX = 1 ether;

    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;
        address airline;
        string flight;
        bool credited;
    }

    struct RegisterationApproval {
        address[] approvals;
        bool paidFees;
    }

    struct Insurance {
        address owner;
        uint256 paidAmmount;
        bool exist;
    }

    struct FlightInsuranceFinder {
        bytes32 flightKey;
        uint256 flightIndex;
        bool exist;
    }

    address private _contractOwner; // Account used to deploy contract

    bytes32[] private _flightKeys; // Holds all flight keys and used for looping through all the flights.
    mapping(bytes32 => Flight) private _flights; // Holds all the registred flights created by the airline.
    mapping(bytes32 => Insurance[]) private _flightInsurees; // Holds the data of those who bought insurance that belongs to a certain flight key.
    mapping(address => FlightInsuranceFinder) _ownerInsuranceFinder; // Holds the finders which links the owner to the insurance instance in flight insureers.

    mapping(address => RegisterationApproval) private _pendingApprovals; // Holding all the airlines in the approval process.
    IFlightSuretyData private _dataContract; // The data contract.
    uint256 private _balance = 0 ether; // Holds the current balance of the contract.

    /********************************************************************************************/
    /*                                       Events                                             */
    /********************************************************************************************/
    event AirlineRegistred(address airline);

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
     * @dev Modifier that requires the "operational" boolean variable to be "true"
     *      This is used on all state changing functions to pause the contract in
     *      the event there is an issue that needs to be fixed
     */
    modifier requireIsOperational() {
        // Modify to call data contract's status
        require(
            _dataContract.isOperational(),
            "Contract is currently not operational"
        );
        _; // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
     * @dev Modifier that requires the "ContractOwner" account to be the function caller
     */
    modifier requireContractOwner() {
        require(msg.sender == _contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireNonRegistredAirline(address airline) {
        require(
            !_dataContract.isAirline(airline),
            "The airline is already registered"
        );
        _;
    }

    modifier requireRegistredAirline() {
        require(
            _dataContract.isAirline(msg.sender),
            "The airline is not registred"
        );
        _;
    }

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
     * @dev Contract constructor
     *
     */
    constructor(address dataContractAddress) public {
        require(msg.sender != address(0), "The sender can't be left empty");
        require(
            dataContractAddress != address(0),
            "The data contract address can't be left empty"
        );
        _contractOwner = msg.sender;
        _dataContract = IFlightSuretyData(dataContractAddress);
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Add an airline to the registration queue
     *      Can only be called from FlightSuretyApp contract
     *
     */
    function registerAirline(address newAirline)
        external
        requireIsOperational
        requireRegistredAirline
        requireNonRegistredAirline(newAirline)
    {
        if (_dataContract.getAirlinesCount() < MIN_AIRLINES_BEFORE_CONSENSYS) {
            // Pushing the message sender to the list of approvals.
            // Skipping the check for unique approvals since all we need in this case is one approval.
            _pendingApprovals[newAirline].approvals.push(msg.sender);

            // Checking the airline has paid the fees.
            _checkRegistrationApprovalState(newAirline);
        } else {
            // Checking if the message sender has already approved the airline.
            bool existingApproval = false;
            for (
                uint256 i;
                i < _pendingApprovals[newAirline].approvals.length;
                i++
            )
                if (_pendingApprovals[newAirline].approvals[i] == msg.sender) {
                    existingApproval = true;
                    break;
                }

            require(
                !existingApproval,
                "The sender has already approved for this airline"
            );

            // Adding the approval to the list of approvals
            _pendingApprovals[newAirline].approvals.push(msg.sender);

            // Checking if the airline is ready to be registred.
            _checkRegistrationApprovalState(newAirline);
        }
    }

    /**
     * @dev Allows the airline to pay the fees of its own registration.
     * Only the airline is allowed to pay the registration fees for its own.
     */
    function payRegistrationFee()
        external
        payable
        requireIsOperational
        requireNonRegistredAirline(msg.sender)
    {
        // Making sure the value paid equals to the requried fees.
        require(
            msg.value == REQUIRED_REGISTRATION_FEE,
            "The sent value doesn't equal the required registration fee"
        );

        require(
            !_pendingApprovals[msg.sender].paidFees,
            "The fees has already been paid"
        );

        // Adding the current sender in the pending approvals list with paidFees to be true.
        _pendingApprovals[msg.sender].paidFees = true;

        // Adding funds to the contract.
        _balance = _balance.add(msg.value);

        // Checking if the approvals state is complete and the airline is ready to be registred or not.
        _checkRegistrationApprovalState(msg.sender);
    }

    /**
     * @dev Checks if the airline is ready to be registred, and registres it if so.
     */
    function _checkRegistrationApprovalState(address pendingAirline) private {
        uint256 airlinesCount = _dataContract.getAirlinesCount();
        if (
            airlinesCount < MIN_AIRLINES_BEFORE_CONSENSYS &&
            _pendingApprovals[pendingAirline].paidFees &&
            _pendingApprovals[pendingAirline].approvals.length > 0 // All we need is one approval in this case.
        ) {
            _dataContract.addAirline(pendingAirline);
            delete _pendingApprovals[pendingAirline];
            emit AirlineRegistred(pendingAirline);
        }
        // Checking the approval number has reached the threshold and adding the airline accordingly.
        else if (
            airlinesCount >= MIN_AIRLINES_BEFORE_CONSENSYS &&
            _pendingApprovals[pendingAirline].paidFees &&
            _pendingApprovals[pendingAirline].approvals.length >=
            (airlinesCount / 2)
        ) {
            // Adding the airline to registred airlines lis
            _dataContract.addAirline(pendingAirline);
            delete _pendingApprovals[pendingAirline];
            emit AirlineRegistred(pendingAirline);
        }
    }

    /**
     * @dev Register a future flight for insuring.
     *
     */
    function registerFlight(string flight, uint256 timestamp)
        external
        requireRegistredAirline
    {
        bytes32 key = getFlightKey(msg.sender, flight, timestamp);

        require(!_flights[key].isRegistered, "Flight already exist");

        _flights[key] = Flight({
            isRegistered: true,
            airline: msg.sender,
            flight: flight,
            statusCode: STATUS_CODE_UNKNOWN,
            updatedTimestamp: timestamp,
            credited: false
        });

        _flightKeys.push(key);
    }

    function isFlight(
        address airline,
        string flight,
        uint256 timestamp
    ) external view requireContractOwner returns (bool) {
        bytes32 key = getFlightKey(airline, flight, timestamp);
        return _flights[key].isRegistered;
    }

    /**
     * @dev Buy insurance for a flight
     *
     */
    function buy(
        address airline,
        string flight,
        uint256 timestamp
    ) external payable {
        // Validating the paid ammount.
        require(
            msg.value > 0 && msg.value < INSURANCE_FEES_MAX,
            "Invalid payment value"
        );

        // Checking the flight exists.
        bytes32 key = getFlightKey(airline, flight, timestamp);
        require(_flights[key].isRegistered, "Flight is not found");

        // Creating the insurance instance.
        Insurance memory boughtInsurance = Insurance({
            owner: msg.sender,
            paidAmmount: msg.value,
            exist: true
        });

        // Adding the value of the msg to the balance.
        _balance = _balance.add(msg.value);

        // Adding the insurance instance to the proper lists.
        _flightInsurees[key].push(boughtInsurance);

        // Adding the insurance finder to be able to retrieve insurace without looping.
        FlightInsuranceFinder memory finder = FlightInsuranceFinder({
            flightKey: key,
            flightIndex: _flightInsurees[key].length - 1,
            exist: true
        });

        _ownerInsuranceFinder[msg.sender] = finder;
    }

    function getInsurancePayment(address customer)
        external
        view
        requireContractOwner
        returns (uint256)
    {
        require(
            _ownerInsuranceFinder[customer].exist,
            "The customer didn't buy any insurance"
        );
        bytes32 flightKey = _ownerInsuranceFinder[customer].flightKey;
        uint256 flightIndex = _ownerInsuranceFinder[customer].flightIndex;
        uint256 paidAmmount = _flightInsurees[flightKey][flightIndex]
            .paidAmmount;

        return paidAmmount;
    }

    /**
     *  @dev Credits payouts to insurees
     */
    function creditInsurees() external requireContractOwner {
        uint8 status;
        bytes32 key;
        // uint256 factor = SafeMath.div(3, 2);

        // Looping all over the flight keys. And checking the flight status.
        // If the flight was delayed, increase the paid ammount of all who
        // bought insurance by 1.5.
        for (uint256 i = 0; i < _flightKeys.length; i++) {
            key = _flightKeys[i];
            status = _flights[key].statusCode;
            // Checking the flight status.
            if (
                status != STATUS_CODE_ON_TIME &&
                status != STATUS_CODE_UNKNOWN &&
                !_flights[key].credited
            ) {
                _flights[key].credited = true;
                for (uint256 j = 0; j < _flightInsurees[key].length; j++) {
                    uint256 ammount = _flightInsurees[key][j].paidAmmount;
                    ammount = ammount.mul(3).div(2);
                    _flightInsurees[key][j].paidAmmount = ammount;
                }
            }
        }
    }

    /**
     * @dev Initial funding for the insurance. Unless there are too many delayed flights
     *      resulting in insurance payouts, the contract should be self-sustaining
     *
     */
    function fund() public payable requireContractOwner {
        require(
            _ownerInsuranceFinder[msg.sender].exist,
            "The insurance doesn't exist or has been already funded"
        );

        bytes32 flightKey = _ownerInsuranceFinder[msg.sender].flightKey;
        uint256 flightIndex = _ownerInsuranceFinder[msg.sender].flightIndex;
        uint256 creditAmmount = _flightInsurees[flightKey][flightIndex]
            .paidAmmount;

        require(
            creditAmmount <= _balance,
            "The contract balance is not enough."
        );

        delete _ownerInsuranceFinder[msg.sender];
        msg.sender.transfer(creditAmmount);
    }

    /**
     * @dev Adds balance to the contract by the contract owner.
     */
    function addBalance() external payable requireContractOwner {
        require(msg.value > 0, "The balance can't be 0");
        _balance = _balance.add(msg.value);
    }

    /**
     * @dev Withdraws balance from the contract by the contract owner.
     */
    function withdrawBalance(uint32 withdrawAmmount)
        external
        requireContractOwner
    {
        require(
            withdrawAmmount >= _balance,
            "Balance doesn't cover the required ammount"
        );
        _balance = _balance.sub(withdrawAmmount);
        _contractOwner.transfer(withdrawAmmount);
    }

    /**
     * @dev Gets the current value of the balance held by the contract.
     */
    function getCurrentBalance()
        external
        view
        requireContractOwner
        returns (uint256)
    {
        return _balance;
    }

    /**
     * @dev Fallback function for funding smart contract.
     *
     */
    function() external payable {
        fund();
    }

    /**
     * @dev Called after oracle has updated flight status
     *
     */
    function processFlightStatus(
        address airline,
        string flight,
        uint256 timestamp,
        uint8 statusCode
    ) public {
        bytes32 key = getFlightKey(airline, flight, timestamp);
        require(_flights[key].isRegistered, "Flight is not found");
        _flights[key].statusCode = statusCode;
    }

    function getFlightStatus(
        address airline,
        string flight,
        uint256 timestamp
    ) external view requireContractOwner returns (uint8) {
        bytes32 key = getFlightKey(airline, flight, timestamp);
        require(_flights[key].isRegistered, "Flight is not found");
        return _flights[key].statusCode;
    }

    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus(
        address airline,
        string flight,
        uint256 timestamp
    ) external {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(
            abi.encodePacked(index, airline, flight, timestamp)
        );
        oracleResponses[key] = ResponseInfo({
            requester: msg.sender,
            isOpen: true
        });

        emit OracleRequest(index, airline, flight, timestamp);
    }

    // region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;

    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester; // Account that requested status
        bool isOpen; // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses; // Mapping key is the status code reported
        // This lets us group responses and identify
        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(
        address airline,
        string flight,
        uint256 timestamp,
        uint8 status
    );

    event OracleReport(
        address airline,
        string flight,
        uint256 timestamp,
        uint8 status
    );

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(
        uint8 index,
        address airline,
        string flight,
        uint256 timestamp
    );

    // Register an oracle with the contract
    function registerOracle() external payable {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({isRegistered: true, indexes: indexes});
    }

    function getMyIndexes() external view returns (uint8[3]) {
        require(
            oracles[msg.sender].isRegistered,
            "Not registered as an oracle"
        );

        return oracles[msg.sender].indexes;
    }

    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse(
        uint8 index,
        address airline,
        string flight,
        uint256 timestamp,
        uint8 statusCode
    ) external {
        require(
            (oracles[msg.sender].indexes[0] == index) ||
                (oracles[msg.sender].indexes[1] == index) ||
                (oracles[msg.sender].indexes[2] == index),
            "Index does not match oracle request"
        );

        bytes32 key = keccak256(
            abi.encodePacked(index, airline, flight, timestamp)
        );
        require(
            oracleResponses[key].isOpen,
            "Flight or timestamp do not match oracle request"
        );

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (
            oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES
        ) {
            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(airline, flight, timestamp, statusCode);
        }
    }

    function getFlightKey(
        address airline,
        string flight,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes(address account) internal returns (uint8[3]) {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);

        indexes[1] = indexes[0];
        while (indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while ((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex(address account) internal returns (uint8) {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(
            uint256(
                keccak256(
                    abi.encodePacked(blockhash(block.number - nonce++), account)
                )
            ) % maxValue
        );

        if (nonce > 250) {
            nonce = 0; // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

    // endregion
}

contract IFlightSuretyData {
    function isOperational() public view returns (bool) {}

    function isAirline(address checkedAirline) external view returns (bool) {}

    function getAirlinesCount() external view returns (uint256) {}

    function addAirline(address newAirline) external {}
}

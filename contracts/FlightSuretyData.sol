pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/
    uint8 private MIN_AIRLINES_BEFORE_CONSENSYS = 4;
    uint256 private REQUIRED_REGISTRATION_FEE = 10 ether;

    struct Airline {
        bool registred;
    }

    struct RegisterationApproval {
        address[] approvals;
        bool paidFees;
    }

    address private _contractOwner; // Account used to deploy contract
    bool private _operational = true; // Blocks all state changes throughout the contract if false
    mapping(address => Airline) private _airlines; // Holding the registred successfully mapping.
    mapping(address => RegisterationApproval) _pendingApprovals; // Holding all the airlines in the approval process
    uint256 private _airlinesLength = 0; // Holds the length of pending approvals mapping.

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    event AirlineRegistred(address airline);

    /**
     * @dev Constructor
     *      The deploying account becomes contractOwner
     */
    constructor(address firstAirline) public {
        require(msg.sender != address(0), "The contract must have an owner");
        require(
            firstAirline != address(0),
            "The first airline can be left empty"
        );
        _contractOwner = msg.sender;
        // Adding the first airline to the list to be able to add other airlines.
        _airlines[firstAirline] = Airline({registred: true});
        _airlinesLength++;
    }

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
        require(_operational, "Contract is currently not operational");
        _; // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
     * @dev Modifier that requires the "ContractOwner" account to be the function caller
     */
    modifier requireContractOwner() {
        require(msg.sender == _contractOwner, "Caller is not contract owner");
        _;
    }

    /**
     * @dev Modifier that requires the arg airline to be a NON registred airline.
     */
    modifier requiresNonRegistredAirline(address airline) {
        require(
            !_airlines[airline].registred,
            "The airline is already registred."
        );
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
     * @dev Get operating status of contract
     *
     * @return A bool that is the current operating status
     */
    function isOperational() public view returns (bool) {
        return _operational;
    }

    /**
     * @dev Sets contract operations on/off
     *
     * When operational mode is disabled, all write transactions except for this one will fail
     */
    function setOperatingStatus(bool mode) external requireContractOwner {
        require(mode != _operational, "The value has to be different.");
        _operational = mode;
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
        requiresNonRegistredAirline(newAirline)
    {
        if (_airlinesLength < MIN_AIRLINES_BEFORE_CONSENSYS) {
            // Checking the sender is an already existing airline.
            require(
                _airlines[msg.sender].registred,
                "The sender is not a registred air line"
            );

            // Pushing the message sender to the list of approvals.
            // Skipping the check for unique approvals since all we need in this case is one approval.
            _pendingApprovals[newAirline].approvals.push(msg.sender);

            // Checking the airline has paid the fees.
            _checkRegistrationApprovalState(newAirline);
        } else {
            // Retrieving the set of approvals for the airline to be registred.
            address[] storage approvals = _pendingApprovals[newAirline]
                .approvals;

            // Checking if the message sender has already approved the airline.
            bool existingApproval = false;
            for (uint256 i; i < approvals.length; i++)
                if (approvals[i] == msg.sender) {
                    existingApproval = true;
                    break;
                }

            require(
                existingApproval,
                "The sender has already approved for this airline"
            );

            // Adding the approval to the list of approvals
            approvals.push(msg.sender);

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
        requiresNonRegistredAirline(msg.sender)
    {
        // Making sure the value paid equals to the requried fees.
        require(
            msg.value == REQUIRED_REGISTRATION_FEE,
            "The sent value doesn't equal the required registration fee"
        );

        // Adding the current sender in the pending approvals list with paidFees to be true.
        _pendingApprovals[msg.sender].paidFees = true;

        // Transfering funds to the owner.
        _contractOwner.transfer(msg.value);

        // Checking if the approvals state is complete and the airline is ready to be registred or not.
        _checkRegistrationApprovalState(msg.sender);
    }

    function isAirline(address checkedAirline) external view returns (bool) {
        return _airlines[checkedAirline].registred;
    }

    /**
     * @dev Buy insurance for a flight
     *
     */
    function buy() external payable {}

    /**
     *  @dev Credits payouts to insurees
     */
    function creditInsurees() external pure {}

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
     */
    function pay() external pure {}

    /**
     * @dev Initial funding for the insurance. Unless there are too many delayed flights
     *      resulting in insurance payouts, the contract should be self-sustaining
     *
     */
    function fund() public payable {}

    function getFlightKey(
        address airline,
        string memory flight,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
     * @dev Checks if the airline is ready to be registred, and registres it if so.
     */
    function _checkRegistrationApprovalState(address pendingAirline) private {
        if (
            _airlinesLength < MIN_AIRLINES_BEFORE_CONSENSYS &&
            _pendingApprovals[pendingAirline].paidFees &&
            _pendingApprovals[pendingAirline].approvals.length > 0 // All we need is one approval in this case.
        ) {
            // Adding the airline to registred airlines lis
            _airlines[pendingAirline] = Airline({registred: true});
            _airlinesLength++;
            delete _pendingApprovals[pendingAirline];
            emit AirlineRegistred(pendingAirline);
        }
        // Checking the approval number has reached the threshold and adding the airline accordingly.
        else if (
            _airlinesLength >= MIN_AIRLINES_BEFORE_CONSENSYS &&
            _pendingApprovals[pendingAirline].paidFees &&
            _pendingApprovals[pendingAirline].approvals.length >=
            (_airlinesLength / 2)
        ) {
            // Adding the airline to registred airlines lis
            _airlines[pendingAirline] = Airline({registred: true});
            _airlinesLength++;
            delete _pendingApprovals[pendingAirline];
            emit AirlineRegistred(pendingAirline);
        }
    }

    /**
     * @dev Fallback function for funding smart contract.
     *
     */
    function() external payable {
        fund();
    }
}

pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/
    struct Airline {
        bool registred;
    }

    address private _contractOwner; // Account used to deploy contract.
    bool private _operational = true; // Blocks all state changes throughout the contract if false.
    mapping(address => Airline) private _airlines; // Holding the registred successfully mapping.
    uint256 private _airlinesLength = 0; // Holds the length of pending approvals mapping.
    mapping(address => bool) _authorizedContracts; // Holds all autorized contracts to access restricted functions and data.

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

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

    modifier requireCallerAuthorized() {
        require(
            _authorizedContracts[msg.sender],
            "The caller is not an authorized contract"
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

    function authorizeCaller(address contractAddress)
        external
        requireContractOwner
    {
        _authorizedContracts[contractAddress] = true;
    }

    function unauthorizeCaller(address contractAddress)
        external
        requireContractOwner
    {
        delete _authorizedContracts[contractAddress];
    }

    function isAirline(address checkedAirline) external view returns (bool) {
        return _airlines[checkedAirline].registred;
    }

    function addAirline(address newAirline)
        external
        requireIsOperational
        requireCallerAuthorized
    {
        require(
            !_airlines[newAirline].registred,
            "The airline is already registred."
        );
        _airlines[newAirline] = Airline({registred: true});
        _airlinesLength++;
    }

    function getAirlinesCount()
        external
        view
        requireCallerAuthorized
        returns (uint256)
    {
        return _airlinesLength;
    }

    // /**
    //  * @dev Buy insurance for a flight
    //  *
    //  */
    // function buy() external payable {}

    // /**
    //  *  @dev Credits payouts to insurees
    //  */
    // function creditInsurees() external pure {}

    // /**
    //  *  @dev Transfers eligible payout funds to insuree
    //  *
    //  */
    // function pay() external pure {}

    // /**
    //  * @dev Initial funding for the insurance. Unless there are too many delayed flights
    //  *      resulting in insurance payouts, the contract should be self-sustaining
    //  *
    //  */
    // function fund() public payable {}

    // function getFlightKey(
    //     address airline,
    //     string memory flight,
    //     uint256 timestamp
    // ) internal pure returns (bytes32) {
    //     return keccak256(abi.encodePacked(airline, flight, timestamp));
    // }

    // /**
    //  * @dev Fallback function for funding smart contract.
    //  *
    //  */
    // function() external payable {
    //     fund();
    // }
}


import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


(async () => {

    let result = null;

    let contract = new Contract('localhost', () => {

        // Read transaction
        contract.isOperational((error, result) => {
            console.log(error, result);
            display('Operational Status', 'Check if contract is operational', [{ label: 'Operational Status', error: error, value: result }]);
        });

        var currentUserElement = document.getElementById("user-id");
        currentUserElement.innerHTML = contract.currentAccount;

        // address.appendChild(document.createTextNode("Your address :  " + contract.passengers[0]));

        // User-submitted transaction
        DOM.elid('btn-register-airline').addEventListener('click', () => {
            let airline = DOM.elid('txt-register-airline').value;
            contract.registerAirline(airline);
            // Write transaction
            // contract.registerAirline(airline, (error, result) => {
            //     display('Oracles', 'Trigger oracles', [{ label: 'Fetch Flight Status', error: error, value: result.flight + ' ' + result.timestamp }]);
            // });
        });

        DOM.elid("btn-pay-registration-fees").addEventListener('click', () => {
            let airline = DOM.elid('txt-pay-registration-fees').value;
            contract.payRegistrationFee(airline);
        })

        DOM.elid("btn-add-flight").addEventListener('click', () => {
            let flightNumber = DOM.elid('txt-add-flight').value;
            let timestamp = (new Date).getTime();
            console.log("Added Flight Timestamp:", timestamp);
            contract.registerFlight(contract.currentAccount, flightNumber, timestamp);
        })


        DOM.elid("btn-purchase-flight").addEventListener('click', () => {
            let airline = DOM.elid('txt-purchase-airline').value;
            let flightNumber = DOM.elid('txt-purchase-flight').value;
            let timestamp = DOM.elid('txt-purchase-timestamp').value;
            contract.buy(airline, flightNumber, timestamp, contract.currentAccount);
        })

        DOM.elid("btn-status-flight").addEventListener('click', () => {
            let airline = DOM.elid('txt-status-airline').value;
            let flightNumber = DOM.elid('txt-status-flight').value;
            let timestamp = DOM.elid('txt-status-timestamp').value;
            contract.fetchFlightStatus(airline, flightNumber, timestamp);
        })

        DOM.elid("btn-credit-insurees").addEventListener('click', () => {
            contract.creditInsurees();
        })

        DOM.elid("btn-fund-insurance").addEventListener('click', () => {
            contract.fund();
        })

    });


})();





function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({ className: 'row' }));
        row.appendChild(DOM.div({ className: 'col-sm-4 field' }, result.label));
        row.appendChild(DOM.div({ className: 'col-sm-8 field-value' }, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);

}








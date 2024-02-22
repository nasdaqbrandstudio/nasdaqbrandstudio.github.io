const nasdaqApiResponse = {
    "data": [
        {
            "symbol": "AAPL",
            "companyName": "Apple Inc.",
            "lastSale": "164.68",
            "netChange": "-0.65",
            "percentageChange": "-0.39%",
            "marketCap": "2.778T",
            "country": "United States",
            "ipoYear": "1980"
        },
        {
            "symbol": "MSFT",
            "companyName": "Microsoft Corporation",
            "lastSale": "293.87",
            "netChange": "+0.52",
            "percentageChange": "+0.18%",
            "marketCap": "2.217T",
            "country": "United States",
            "ipoYear": "1986"
        },
        // Add more data entries as needed
    ]
};

async function filterData() {
    const symbol = document.getElementById('symbol').value.toUpperCase();
    
    const filteredData = nasdaqApiResponse.data.filter(item => item.symbol.toUpperCase().includes(symbol));
    displayData(filteredData);
}

function displayData(data) {
    const container = document.getElementById('filtered-data');
    container.innerHTML = '';

    if (data.length === 0) {
        container.textContent = 'No data found.';
        return;
    }

    const table = document.createElement('table');
    const headerRow = table.insertRow();
    ['Symbol', 'Company', 'Last Sale', 'Net Change', '% Change', 'Market Cap', 'Country', 'IPO Year'].forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });

    data.forEach(item => {
        const row = table.insertRow();
        ['symbol', 'companyName', 'lastSale', 'netChange', 'percentageChange', 'marketCap', 'country', 'ipoYear'].forEach(key => {
            const cell = row.insertCell();
            cell.textContent = item[key];
        });
    });

    container.appendChild(table);
}
async function filterData() {
    const symbol = document.getElementById('symbol').value.toUpperCase();
    console.log('Filtering data for symbol:', symbol);
    
    const response = await fetch(`https://api.nasdaq.com/api/quote/list-type/NASDAQ100`);
    const data = await response.json();
    console.log('API response:', data);
    
    const filteredData = data.data.filter(item => item.symbol.toUpperCase().includes(symbol));
    console.log('Filtered data:', filteredData);

    displayData(filteredData);
}

function displayData(data) {
    console.log('Displaying filtered data:', data);
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

    const container = document.getElementById('filtered-data');
    container.innerHTML = '';
    container.appendChild(table);
}
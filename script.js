async function filterData() {
    const symbol = document.getElementById('symbol').value.toUpperCase();
    const proxyUrl = 'https://cors-anywhere.herokuapp.com/'; // CORS proxy service
    const apiUrl = 'https://api.nasdaq.com/api/quote/list-type/NASDAQ100';
    
    try {
        const response = await fetch(proxyUrl + apiUrl);
        const data = await response.json();
        
        const filteredData = data.data.filter(item => item.symbol.toUpperCase().includes(symbol));

        displayData(filteredData);
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

function displayData(data) {
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
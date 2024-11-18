const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const marketOverview = document.getElementById('marketOverview');
const stockData = document.getElementById('stockData');
const comparisonContainer = document.getElementById('comparisonContainer');
const comparisonButtons = document.getElementById('comparisonButtons');
const compareButton = document.getElementById('compareButton');
const compareInput = document.getElementById('compareInput');
const compareSymbol = document.getElementById('compareSymbol');
const searchHistory = document.getElementById('searchHistory');

let chart;
let timeFrame = '1M';
let comparisonSymbols = [];

const API_KEY = '3a_CVMYVd8EvvCQPALGaQWpAHAKNOFKn';

searchButton.addEventListener('click', () => handleSearch(searchInput.value));
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch(searchInput.value);
});

compareButton.addEventListener('click', () => {
    compareInput.style.display = 'block';
    compareButton.style.display = 'none';
});

compareSymbol.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        addComparisonSymbol(compareSymbol.value.toUpperCase());
        compareSymbol.value = '';
    }
});

document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => handleTimeFrameChange(button.dataset.timeframe));
});

async function handleSearch(symbol) {
    if (!symbol) {
        alert("Please enter a stock symbol");
        return;
    }

    try {
        const data = await fetchStockData(symbol);
        displayStockData(data);
        updateSearchHistory(symbol);
        comparisonSymbols = [symbol];
        await fetchComparisonData([symbol], timeFrame);
    } catch (error) {
        console.error("Error:", error);
        alert("Failed to fetch stock data");
    }
}

async function fetchStockData(symbol) {
    const date = getLastValidTradingDay();
    const response = await fetch(`https://api.polygon.io/v1/open-close/${symbol}/${date}?adjusted=true&apiKey=${API_KEY}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data.status === 'NOT_FOUND') throw new Error("Stock symbol not found");
    if (data.status === 'ERROR') throw new Error(data.error || "An error occurred");
    return data;
}

function displayStockData(data) {
    marketOverview.style.display = 'none';
    stockData.style.display = 'block';
    comparisonContainer.style.display = 'block';

    document.getElementById('stockSymbol').textContent = data.symbol;
    document.getElementById('stockOpen').textContent = `$${data.open.toFixed(2)}`;
    document.getElementById('stockClose').textContent = `$${data.close.toFixed(2)}`;
    document.getElementById('stockHigh').textContent = `$${data.high.toFixed(2)}`;
    document.getElementById('stockLow').textContent = `$${data.low.toFixed(2)}`;
    document.getElementById('stockVolume').textContent = data.volume.toLocaleString();
    document.getElementById('stockDate').textContent = new Date(data.from).toLocaleDateString();

    const arrow = document.getElementById('stockArrow');
    arrow.innerHTML = data.close > data.open ? 
        '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 2L2 14H14L8 2Z" fill="#00EB80" /></svg>' :
        '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 14L2 2H14L8 14Z" fill="#ED8082" /></svg>';
}

async function fetchComparisonData(symbols, timeFrame) {
    const { startDate, endDate } = getDateRange(timeFrame);
    const promises = symbols.map(symbol =>
        fetch(`https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${startDate}/${endDate}?adjusted=true&sort=asc&limit=120&apiKey=${API_KEY}`)
            .then(response => response.json())
    );

    const results = await Promise.all(promises);
    const processedData = processComparisonData(results, symbols);
    updateComparisonChart(processedData, symbols);
    updateComparisonButtons(symbols);
}

function processComparisonData(results, symbols) {
    const processedData = {};
    results.forEach((result, index) => {
        if (result.results) {
            result.results.forEach(day => {
                const date = new Date(day.t).toISOString().split('T')[0];
                if (!processedData[date]) {
                    processedData[date] = { date };
                }
                processedData[date][symbols[index]] = day.c;
            });
        }
    });
    return Object.values(processedData);
}

function updateComparisonChart(data, symbols) {
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    
    if (chart) {
        chart.destroy();
    }

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.date),
            datasets: symbols.map((symbol, index) => ({
                label: symbol,
                data: data.map(d => d[symbol]),
                borderColor: getColor(index),
                fill: false
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: getTimeUnit(timeFrame)
                    }
                }
            }
        }
    });
}

function updateComparisonButtons(symbols) {
    comparisonButtons.innerHTML = '';
    symbols.forEach(symbol => {
        const button = document.createElement('button');
        button.textContent = symbol;
        button.addEventListener('click', () => removeComparisonSymbol(symbol));
        comparisonButtons.appendChild(button);
    });
}

function addComparisonSymbol(symbol) {
    if (!comparisonSymbols.includes(symbol)) {
        comparisonSymbols.push(symbol);
        fetchComparisonData(comparisonSymbols, timeFrame);
    }
}

function removeComparisonSymbol(symbol) {
    comparisonSymbols = comparisonSymbols.filter(s => s !== symbol);
    if (comparisonSymbols.length > 0) {
        fetchComparisonData(comparisonSymbols, timeFrame);
    } else {
        comparisonContainer.style.display = 'none';
    }
}

function handleTimeFrameChange(newTimeFrame) {
    timeFrame = newTimeFrame;
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.toggle('active', button.dataset.timeframe === newTimeFrame);
    });
    fetchComparisonData(comparisonSymbols, timeFrame);
}

function updateSearchHistory(symbol) {
    const historyItem = document.createElement('button');
    historyItem.textContent = symbol;
    historyItem.addEventListener('click', () => handleSearch(symbol));
    searchHistory.prepend(historyItem);
    if (searchHistory.children.length > 5) {
        searchHistory.removeChild(searchHistory.lastChild);
    }
}

function getLastValidTradingDay() {
    const date = new Date();
    do {
        date.setDate(date.getDate() - 1);
    } while (date.getDay() === 0 || date.getDay() === 6);
    return date.toISOString().split('T')[0];
}

function getDateRange(timeFrame) {
    const endDate = new Date();
    let startDate = new Date();
    switch (timeFrame) {
        case '1D': startDate.setDate(startDate.getDate() - 1); break;
        case '1W': startDate.setDate(startDate.getDate() - 7); break;
        case '1M': startDate.setMonth(startDate.getMonth() - 1); break;
        case '3M': startDate.setMonth(startDate.getMonth() - 3); break;
        case '1Y': startDate.setFullYear(startDate.getFullYear() - 1); break;
        case '5Y': startDate.setFullYear(startDate.getFullYear() - 5); break;
    }
    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
    };
}

function getTimeUnit(timeFrame) {
    switch (timeFrame) {
        case '1D': return 'hour';
        case '1W': return 'day';
        case '1M': case '3M': return 'week';
        case '1Y': case '5Y': return 'month';
        default: return 'day';
    }
}

function getColor(index) {
    const colors = ['#0092BC', '#FFF466', '#9A7DF4', '#5CFFA6', '#818181'];
    return colors[index % colors.length];
}
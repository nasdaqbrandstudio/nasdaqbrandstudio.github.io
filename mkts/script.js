const QQQ_HOLDINGS = new Set([
    "NVDA", "AAPL", "MSFT", "AMZN", "AVGO", "META", "TSLA", "COST", "GOOGL", "GOOG",
    "NFLX", "TMUS", "CSCO", "ADBE", "PEP", "AMD", "LIN", "INTU", "ISRG", "TXN",
    "QCOM", "CMCSA", "BKNG", "AMGN", "HON", "AMAT", "PANW", "VRTX", "ADP", "GILD",
    "SBUX", "MU", "INTC", "ADI", "MELI", "LRCX", "CTAS", "PYPL", "MDLZ", "REGN",
    "KLAC", "SNPS", "CDNS", "CRWD", "MAR", "MRVL", "PDD", "FTNT", "ORLY", "CSX",
    "CEG", "DASH", "ADSK", "ASML", "ROP", "PCAR", "WDAY", "ABNB", "CHTR", "TTD",
    "NXPI", "CPRT", "MNST", "FANG", "PAYX", "AEP", "ODFL", "FAST", "ROST", "KDP",
    "EA", "BKR", "VRSK", "CTSH", "TEAM", "DDOG", "KHC", "LULU", "GEHC", "XEL",
    "EXC", "AZN", "CCEP", "MCHP", "IDXX", "TTWO", "ZS", "CSGP", "ANSS", "ON",
    "DXCM", "CDW", "BIIB", "WBD", "GFS", "ILMN", "MDB", "ARM", "MRNA", "DLTR", "SMCI"
]);

document.addEventListener('DOMContentLoaded', () => {
    const searchButton = document.getElementById('searchButton');
    const stockSymbolInput = document.getElementById('stockSymbol');
    const stockDataDiv = document.getElementById('stockData');
    const qqqAdDiv = document.getElementById('qqqAd');

    searchButton.addEventListener('click', handleSearch);
    stockSymbolInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    async function handleSearch() {
        const searchTerm = stockSymbolInput.value.trim().toUpperCase();
        if (!searchTerm) {
            alert("Please enter a stock symbol");
            return;
        }

        searchButton.disabled = true;
        searchButton.textContent = 'Searching...';

        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const formattedDate = yesterday.toISOString().split('T')[0];

            const response = await axios.get(
                `https://api.polygon.io/v1/open-close/${searchTerm}/${formattedDate}`,
                {
                    params: {
                        adjusted: true,
                        apiKey: 'wq6W2F_TIARoEsL7rJp71TYydO2g0dkp'
                    }
                }
            );

            const data = response.data;
            
            if (data.status === 'NOT_FOUND') {
                alert("Stock symbol not found");
                stockDataDiv.classList.add('hidden');
                qqqAdDiv.classList.add('hidden');
                return;
            }
            
            if (data.status === 'ERROR') {
                alert(data.error || "An error occurred");
                stockDataDiv.classList.add('hidden');
                qqqAdDiv.classList.add('hidden');
                return;
            }

            displayStockData(data);
            qqqAdDiv.classList.toggle('hidden', !QQQ_HOLDINGS.has(searchTerm));
        } catch (error) {
            console.error(error);
            alert("Failed to fetch stock data");
            stockDataDiv.classList.add('hidden');
            qqqAdDiv.classList.add('hidden');
        } finally {
            searchButton.disabled = false;
            searchButton.textContent = 'Search';
        }
    }

    function displayStockData(data) {
        const isPositive = data.close > data.open;
        stockDataDiv.innerHTML = `
            <div class="flex items-center mb-4">
                <h2 class="text-nasdaq-blue text-2xl font-bold mr-2">${data.symbol}</h2>
                ${QQQ_HOLDINGS.has(data.symbol) ? '<span class="px-2 py-1 bg-nasdaq-blue text-black text-xs font-bold rounded mr-2">QQQ</span>' : ''}
                <svg class="angular-arrow ${isPositive ? '' : 'negative'}" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 2L2 14H14L8 2Z" />
                </svg>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-nasdaq-blue">Open</p>
                    <p class="font-medium">$${data.open.toFixed(2)}</p>
                </div>
                <div>
                    <p class="text-nasdaq-blue">Close</p>
                    <p class="font-medium">$${data.close.toFixed(2)}</p>
                </div>
                <div>
                    <p class="text-nasdaq-blue">High</p>
                    <p class="font-medium">$${data.high.toFixed(2)}</p>
                </div>
                <div>
                    <p class="text-nasdaq-blue">Low</p>
                    <p class="font-medium">$${data.low.toFixed(2)}</p>
                </div>
                <div>
                    <p class="text-nasdaq-blue">Volume</p>
                    <p class="font-medium">${data.volume.toLocaleString()}</p>
                </div>
                <div>
                    <p class="text-nasdaq-blue">Date</p>
                    <p class="font-medium">${new Date(data.from).toLocaleDateString()}</p>
                </div>
            </div>
        `;
        stockDataDiv.classList.remove('hidden');
    }
});
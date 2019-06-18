const axios = require("axios");

function sleep(ms) {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}

class Market {
	async getLatestStockQuote(ticker) {
		let sourceHtml = null;
		try {
			const response = await axios.get(
				"https://finance.yahoo.com/quote/" + ticker
			);
			sourceHtml = response.data;
		} catch (error) {
			console.error(error);
			throw "CONNECTION_ERROR";
		}

		if (sourceHtml == null) {
			throw "CONNECTION_ERROR";
		}

		let lines = sourceHtml.split("\n");
		for (let l in lines) {
			let line = lines[l];
			if (line.startsWith("root.App.main")) {
				let jsonString = line.substring(16, line.length - 1);
				let json = JSON.parse(jsonString);
				if (
					json.context.dispatcher.stores.PageStore.currentPageName != "quote"
				) {
					throw "UNKNOWN_TICKER";
				}
				let stockData = json.context.dispatcher.stores.QuoteSummaryStore.price;
				let quote = {
					symbol: stockData.symbol,
					price: stockData.regularMarketPrice.raw,
					changePercent: stockData.regularMarketChangePercent.fmt,
					marketState: stockData.marketState
				};
				console.log(quote);
				return quote;
			}
		}
	}

	async getAllStockQuotes(listOfTickers) {
		let quotes = {};
		for (let t in listOfTickers) {
			let ticker = listOfTickers[t];

			quotes[ticker] = await this.getLatestStockQuote(ticker);
			await sleep(400);
		}
		return quotes;
	}
}

export default Market;

const axios = require("axios");

class Market {
	async getLatestStockPrice(ticker) {
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
				console.log("Market state: ", stockData.marketState);
				if (stockData.marketState != "REGULAR") {
					throw "MARKET_NOT_OPEN";
				}
				let price = stockData.regularMarketPrice.raw;
				console.log(price);
				return price;
			}
		}
	}
}

export default Market;

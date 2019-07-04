const axios = require("axios");
const EventEmitter = require("events");

function sleep(ms) {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}

class Market extends EventEmitter {
	constructor() {
		super();
		this.marketData = { state: null, hoursOffset: null };
	}
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
					marketState: stockData.marketState,
					fullName: stockData.shortName
				};
				quote.marketHourOffset =
					json.context.dispatcher.stores.QuoteSummaryStore.quoteType
						.gmtOffSetMilliseconds /
					3600 /
					1000;
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

	async fetchLatestMarketState() {
		const stockQuote = await this.getLatestStockQuote("^GSPC");
		const stateChanged = this.marketData.state != stockQuote.marketState;

		this.marketData.state = stockQuote.marketState;
		this.marketData.hoursOffset = stockQuote.marketHourOffset;

		if (stateChanged) {
			console.log("New market state: ", this.marketData.state);
			this.emit("stateChanged");
		}
	}

	async refreshMarketData() {
		if (this.marketData.state == null) {
			this.fetchLatestMarketState();
			return;
		}

		let unixTime = Date.now();
		let marketTime = unixTime + this.marketData.hoursOffset * 3600 * 1000;
		let date = new Date(marketTime);
		let marketHours = date.getUTCHours(),
			marketMinutes = date.getUTCMinutes();

		if (marketHours == 9 && marketMinutes >= 30 && marketMinutes < 33) {
			this.fetchLatestMarketState();
		}

		if (marketHours == 16 && marketMinutes >= 0 && marketMinutes < 3) {
			this.fetchLatestMarketState();
		}
	}
}

export default Market;

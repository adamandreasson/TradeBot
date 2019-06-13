class Market {
	getLatestStockPrice(ticker) {
		let validTickers = ["TSLA", "AMD"];
		if (validTickers.indexOf(ticker) < 0) {
			return null;
		}

		let prices = {
			TSLA: 210.2,
			AMD: 30.4
		};
		if (prices[ticker] != null) {
			return prices[ticker];
		}
		return null;
	}
}

export default Market;

function Database() {
	this.getUserCash = (serverId, userId) => {
		return { cash: 100 };
	};
	this.getUserHoldings = (serverId, userId) => {
		return { holdings: [{ ticker: "TSLA", amount: 2 }] };
	};
	this.buyStock = (serverId, userId, ticker, sum) => {
		return true;
	};
}

export default Database;

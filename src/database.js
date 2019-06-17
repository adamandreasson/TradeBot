const mysql = require("mysql2/promise");
const config = require("../config.json");

class Database {
	constructor() {
		this.pool = mysql.createPool({
			host: config.mysql.host,
			port: config.mysql.port,
			user: config.mysql.username,
			password: config.mysql.password,
			database: config.mysql.database,
			waitForConnections: true,
			connectionLimit: 10,
			queueLimit: 0
		});
	}

	async getUserCash(serverId, userId) {
		let sql = "SELECT cash FROM accounts WHERE server_id = ? AND user_id = ?";
		let [rows, fields] = await this.pool.query(sql, [serverId, userId]);
		if (rows.length == 0) {
			throw "NO_ACCOUNT";
		}
		return parseInt(rows[0].cash) / 100;
	}
	async subtractPurchaseFromAccount(serverId, userId, amount) {
		amount = amount * 100;
		let sql =
			"UPDATE accounts SET cash = cash - ? WHERE server_id = ? AND user_id = ?";
		let [rows, fields] = await this.pool.query(sql, [amount, serverId, userId]);
		return rows.changedRows > 0;
	}

	async getUserHoldings(serverId, userId) {
		return { holdings: [{ ticker: "TSLA", amount: 2 }] };
	}
	async isUserHoldingTicker(serverId, userId, ticker) {
		let sql =
			"SELECT * FROM holdings WHERE server_id = ? AND user_id = ? AND ticker = ?";
		let [rows, fields] = await this.pool.query(sql, [serverId, userId, ticker]);
		return rows.length > 0;
	}
	async insertHoldings(serverId, userId, ticker, amount, sumOfPurchase) {
		sumOfPurchase = sumOfPurchase * 100;
		let sql =
			"INSERT INTO holdings (server_id, user_id, ticker, count, total_position) VALUES ?";
		let [rows, fields] = await this.pool.query(sql, [
			[[serverId, userId, ticker, amount, sumOfPurchase]]
		]);
		return rows.affectedRows > 0;
	}
	async addToHoldings(serverId, userId, ticker, amount, sumOfPurchase) {
		sumOfPurchase = sumOfPurchase * 100;
		let sql =
			"UPDATE holdings SET count = count + ?, total_position = total_position + ? WHERE server_id = ? AND user_id = ? AND ticker = ?";
		let [rows, fields] = await this.pool.query(sql, [
			amount,
			sumOfPurchase,
			serverId,
			userId,
			ticker
		]);
		return rows.changedRows > 0;
	}
	async getCashOrCreateAccount(serverId, userId) {
		let userFunds = 0;

		try {
			userFunds = await this.getUserCash(serverId, userId);
		} catch (err) {
			if (err === "NO_ACCOUNT") {
				throw "NO ACCOUNT";
			}
		} finally {
			return userFunds;
		}
	}
	async buyStock(serverId, userId, ticker, amount, price) {
		let priceToCharge = price * amount;

		let userFunds = await this.getCashOrCreateAccount(serverId, userId);

		if (userFunds < priceToCharge) {
			throw "NO MONEY";
		}

		let wereFundsReduced = await this.subtractPurchaseFromAccount(
			serverId,
			userId,
			priceToCharge
		);

		if (!wereFundsReduced) {
			throw "Unable to charge user account";
		}

		let userHasHoldings = await this.isUserHoldingTicker(
			serverId,
			userId,
			ticker
		);

		let wasUpdateSuccessful = false;
		if (userHasHoldings) {
			wasUpdateSuccessful = await this.addToHoldings(
				serverId,
				userId,
				ticker,
				amount,
				priceToCharge
			);
		} else {
			wasUpdateSuccessful = await this.insertHoldings(
				serverId,
				userId,
				ticker,
				amount,
				priceToCharge
			);
		}
		return wasUpdateSuccessful;
	}

	async getPortfolio(serverId, userId) {
		let sql =
			"SELECT ticker, count, total_position/100 as totalPosition FROM holdings WHERE server_id = ? AND user_id = ?";
		let [rows, fields] = await this.pool.query(sql, [serverId, userId]);

		let cash = 0;
		try {
			cash = await this.getUserCash(serverId, userId);
		} catch (err) {}

		let portfolio = { cash: cash, holdings: rows };

		return portfolio;
	}
}

export default Database;

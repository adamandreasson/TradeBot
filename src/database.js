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
	async insertHoldings(serverId, userId, ticker, amount) {
		let sql =
			"INSERT INTO holdings (server_id, user_id, ticker, count) VALUES ?";
		let [rows, fields] = await this.pool.query(sql, [
			[[serverId, userId, ticker, amount]]
		]);
		return rows.affectedRows > 0;
	}
	async addToHoldings(serverId, userId, ticker, amount) {
		let sql =
			"UPDATE holdings SET count = count + ? WHERE server_id = ? AND user_id = ? AND ticker = ?";
		let [rows, fields] = await this.pool.query(sql, [
			amount,
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
				amount
			);
		} else {
			wasUpdateSuccessful = await this.insertHoldings(
				serverId,
				userId,
				ticker,
				amount
			);
		}
		return wasUpdateSuccessful;
	}
}

export default Database;

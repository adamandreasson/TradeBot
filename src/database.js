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
	async updateAccount(serverId, userId, amount) {
		amount = amount * 100;
		let sql =
			"UPDATE accounts SET cash = cash + ? WHERE server_id = ? AND user_id = ?";
		let [rows, fields] = await this.pool.query(sql, [amount, serverId, userId]);
		return rows.changedRows > 0;
	}

	async getUserTicketHoldings(serverId, userId, ticker) {
		let sql =
			"SELECT *, total_position/100 as totalPosition FROM holdings WHERE server_id = ? AND user_id = ? AND ticker = ?";
		let [rows, fields] = await this.pool.query(sql, [serverId, userId, ticker]);
		if (rows.length < 1) return null;
		return rows[0];
	}
	async isUserHoldingTicker(serverId, userId, ticker) {
		return (await this.getUserTicketHoldings(serverId, userId, ticker)) != null;
	}
	async clearHoldings(serverId, userId, ticker) {
		let sql =
			"DELETE FROM holdings WHERE server_id = ? AND user_id = ? AND ticker = ?";
		let [rows, fields] = await this.pool.query(sql, [serverId, userId, ticker]);
		return rows.affectedRows > 0;
	}
	async updateHoldings(serverId, userId, ticker, changeAmount, sumOfPurchase) {
		sumOfPurchase = sumOfPurchase * 100;
		let sql =
			"UPDATE holdings SET count = count + ?, total_position = total_position + ? WHERE server_id = ? AND user_id = ? AND ticker = ?";
		let [rows, fields] = await this.pool.query(sql, [
			changeAmount,
			sumOfPurchase,
			serverId,
			userId,
			ticker
		]);
		return rows.changedRows > 0;
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

	async updateOrInsertHoldings(
		serverId,
		userId,
		ticker,
		amount,
		holdingsChange,
		userHasHoldings
	) {
		if (userHasHoldings) {
			return await this.updateHoldings(
				serverId,
				userId,
				ticker,
				amount,
				holdingsChange
			);
		} else {
			return await this.insertHoldings(
				serverId,
				userId,
				ticker,
				amount,
				holdingsChange
			);
		}
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

		let wereFundsReduced = await this.updateAccount(
			serverId,
			userId,
			-priceToCharge
		);

		if (!wereFundsReduced) {
			throw "Unable to charge user account";
		}

		let userHasHoldings = await this.isUserHoldingTicker(
			serverId,
			userId,
			ticker
		);

		let wasUpdateSuccessful = await this.updateOrInsertHoldings(
			serverId,
			userId,
			ticker,
			amount,
			priceToCharge,
			userHasHoldings
		);
		return wasUpdateSuccessful;
	}

	async sellStock(serverId, userId, ticker, amount, price) {
		let userHoldings = await this.getUserTicketHoldings(
			serverId,
			userId,
			ticker
		);

		if (userHoldings.count < amount) {
			amount = userHoldings.count;
		}

		let cashToDeposit = price * amount;
		let avgPosition = userHoldings.totalPosition / userHoldings.count;
		let totalHoldingsChange = -avgPosition * amount;

		let wasUpdateSuccessful = false;

		if (amount == userHoldings.count) {
			wasUpdateSuccessful = await this.clearHoldings(serverId, userId, ticker);
		} else {
			wasUpdateSuccessful = await this.updateHoldings(
				serverId,
				userId,
				ticker,
				-amount,
				totalHoldingsChange
			);
		}

		if (!wasUpdateSuccessful) {
			throw "Database error: Unable to sell your position.";
		}

		let wereFundsAdded = await this.updateAccount(
			serverId,
			userId,
			cashToDeposit
		);

		if (!wereFundsAdded) {
			throw "Database error: Unable to update your account. The money is gone.";
		}

		return { avgPosition: avgPosition, amountSold: amount };
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

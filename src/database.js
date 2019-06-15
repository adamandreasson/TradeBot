const mysql = require("mysql2/promise");
const config = require("../config.json");

function Database() {
	const pool = mysql.createPool({
		host: config.mysql.host,
		port: config.mysql.port,
		user: config.mysql.username,
		password: config.mysql.password,
		database: config.mysql.database,
		waitForConnections: true,
		connectionLimit: 10,
		queueLimit: 0
	});

	this.getUserCash = (serverId, userId) => {
		return { cash: 100 };
	};
	this.getUserHoldings = (serverId, userId) => {
		return { holdings: [{ ticker: "TSLA", amount: 2 }] };
	};
	this.isUserHoldingTicker = async (serverId, userId, ticker) => {
		let sql =
			"SELECT * FROM holdings WHERE server_id = ? AND user_id = ? AND ticker = ?";
		let [rows, fields] = await pool.query(sql, [serverId, userId, ticker]);
		return rows.length > 0;
	};
	this.insertHoldings = async (serverId, userId, ticker, amount) => {
		let sql =
			"INSERT INTO holdings (server_id, user_id, ticker, count) VALUES ?";
		let [rows, fields] = await pool.query(sql, [
			[[serverId, userId, ticker, amount]]
		]);
		return rows.affectedRows > 0;
	};
	this.addToHoldings = async (serverId, userId, ticker, amount) => {
		let sql =
			"UPDATE holdings SET count = count + ? WHERE server_id = ? AND user_id = ? AND ticker = ?";
		let [rows, fields] = await pool.query(sql, [
			amount,
			serverId,
			userId,
			ticker
		]);
		return rows.changedRows > 0;
	};
	this.buyStock = async (serverId, userId, ticker, amount, price) => {
		let userHasHoldings = await this.isUserHoldingTicker(
			serverId,
			userId,
			ticker
		);

		console.log("has holdings? ", userHasHoldings);
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
		console.log("was update successful?", wasUpdateSuccessful);
	};
}

export default Database;

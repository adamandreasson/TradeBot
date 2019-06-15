import { Client } from "discord.js";

import Market from "./market";
import Database from "./database";
const config = require("../config.json");

const client = new Client();
const market = new Market();
const database = new Database();

client.on("ready", () => {
	console.log("I am ready!");
});

function parseBuyCommand(message, params) {
	if (params.length < 3) {
		message.channel.send("Incorrect use of command.");
		return false;
	}
	let amount = parseInt(params[1]);
	if (amount < 1) {
		message.channel.send("Invalid amount.");
		return false;
	}
	let ticker = params[2].toUpperCase();
	let stockPrice = market.getLatestStockPrice(ticker);
	if (stockPrice == null) {
		message.channel.send("Invalid ticker.");
		return;
	}
	console.log(amount, ticker, message.author.id);
	message.channel.send(
		"Bought " + amount + " $" + ticker + " at " + stockPrice
	);
	database.buyStock(
		message.channel.guild.id,
		message.author.id,
		ticker,
		amount
	);
	console.log(message.channel.guild.id);
	console.log(message.author.id);
}

client.on("message", message => {
	if (message.content[0] !== "$" || message.content.length < 2) {
		return;
	}

	let params = message.content
		.substring(1)
		.toLowerCase()
		.split(" ");
	let action = params[0];

	if (action === "buy") {
		return parseBuyCommand(message, params);
	}

	if (action === "sell") {
		return parseSellCommand(message, params);
	}

	if (action === "portfolio") {
		return parsePortfolioCommand(message, params);
	}

	if (action === "ranking") {
		return parseRankingCommand(message, params);
	}
});

client.login(config.discordToken);

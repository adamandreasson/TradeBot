import { Client, RichEmbed } from "discord.js";

import Market from "./market";
import Database from "./database";
const config = require("../config.json");

const client = new Client();
const market = new Market();
const database = new Database();

client.on("ready", () => {
	console.log("I am ready!");
});

function isTickerValid(ticker) {
	const re = /^[A-Z0-9:.]*$/i;
	return re.test(ticker);
}

async function parseBuyCommand(message, params) {
	if (params.length < 3) {
		message.channel.send("Incorrect use of command.");
		return false;
	}
	let amount = parseInt(params[1]);
	if (amount < 1) {
		message.channel.send("Invalid amount.");
		return false;
	}
	if (!isTickerValid(ticker)) {
		message.channel.send(
			"That's a weird ticker format dude... keep it simple."
		);
		return false;
	}
	let ticker = params[2].toUpperCase();
	let stockPrice = 0;
	let tempMessage = await message.channel.send(
		":incoming_envelope: Processing request..."
	);
	try {
		stockPrice = await market.getLatestStockPrice(ticker);
	} catch (err) {
		let userResponse = "Something wen't wrong :(";
		switch (err) {
			case "CONNECTION_ERROR":
				userResponse =
					"Woah I can't handle all these requests rn like wait please";
				break;
			case "MARKET_NOT_OPEN":
				userResponse = "The markets are closed nerd! Go to bed.";
				break;
			case "UNKNOWN_TICKER":
				userResponse = "Wth? " + ticker + " is not a valid stock ticker.";
		}
		tempMessage.delete();
		const embed = new RichEmbed()
			.setTitle("Order error")
			.setColor(0xff0000)
			.setDescription(":warning: " + userResponse);
		message.channel.send(embed);
		return;
	}
	if (stockPrice == 0) {
		console.log("Uh something's wrong here...");
		tempMessage.delete();
		return;
	}
	try {
		let purchaseSuccessful = await database.buyStock(
			message.channel.guild.id,
			message.author.id,
			ticker,
			amount,
			stockPrice
		);
		if (purchaseSuccessful) {
			const embed = new RichEmbed()
				.setTitle(":white_check_mark: Buy order")
				.setColor(0x00ff00)
				.setDescription(
					message.author +
						" purchased " +
						amount +
						" " +
						ticker +
						" at $" +
						stockPrice
				);
			message.channel.send(embed);
		}
	} catch (err) {
		const embed = new RichEmbed()
			.setTitle(":warning: Order error")
			.setColor(0xff0000)
			.setDescription(err);
		message.channel.send(embed);
	}
	tempMessage.delete();
}

client.on("message", message => {
	if (message.content[0] !== "/" || message.content.length < 2) {
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

	if (
		action === "portfolio" ||
		action === "money" ||
		action === "funds" ||
		action === "account"
	) {
		return parsePortfolioCommand(message, params);
	}

	if (action === "ranking") {
		return parseRankingCommand(message, params);
	}

	if (action === "stocks") {
		return parseHelpCommand(message, params);
	}
});

client.login(config.discordToken);

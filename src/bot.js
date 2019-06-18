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

function isMarketOpen(marketState) {
	return marketState == "REGULAR";
}

function isTickerValid(ticker) {
	const re = /^[A-Z0-9:.]*$/i;
	return re.test(ticker);
}

function generateSpacing(string, length) {
	let temp = "";
	for (let i = 0; i < length - string.toString().length; i++) {
		temp += " ";
	}
	return temp;
}

async function sendOrderError(channel, messageString) {
	const embed = new RichEmbed()
		.setTitle("Order error")
		.setColor(0xff0000)
		.setDescription(":warning: " + message);
	channel.send(embed);
}

async function parsePortfolioCommand(message, params) {
	let tempMessage = await message.channel.send(
		":incoming_envelope: Processing request..."
	);
	let portfolio = {};
	try {
		portfolio = await database.getPortfolio(
			message.channel.guild.id,
			message.author.id
		);
	} catch (error) {
		if (error == "NO_ACCOUNT") {
			portfolio = { cash: 0, holdings: [] };
		}
	}
	var tickersToRequest = [];
	for (let t in portfolio.holdings) {
		tickersToRequest.push(portfolio.holdings[t].ticker);
	}
	console.log("getting stock data for all", tickersToRequest);
	let latestQuotes = await market.getAllStockQuotes(tickersToRequest);
	tempMessage.delete();
	console.log(portfolio);
	console.log(latestQuotes);
	/**
	 * Format: TICKER | LAST PRICE $ | DAY CHG % | TOT CHG % | AMOUNT (HOLDING) n | SUM $
	 */
	let portfolioSum = 0;
	let formattedHoldings = "";
	formattedHoldings += "SYM";
	formattedHoldings += generateSpacing("SYM", 6);
	formattedHoldings += generateSpacing("LAST", 9);
	formattedHoldings += "LAST";
	formattedHoldings += " ";
	formattedHoldings += generateSpacing("DAY%", 6);
	formattedHoldings += "DAY%";
	formattedHoldings += " ";
	formattedHoldings += generateSpacing("TOT%", 6);
	formattedHoldings += "TOT%";
	formattedHoldings += " ";
	formattedHoldings += generateSpacing("SUM", 9);
	formattedHoldings += "SUM";
	formattedHoldings += " ";
	formattedHoldings += generateSpacing("AMT", 4);
	formattedHoldings += "AMT";
	formattedHoldings += "\n";
	for (let h in portfolio.holdings) {
		let stock = portfolio.holdings[h];
		portfolioSum += parseFloat(stock.totalPosition);

		let totalPosition = "$" + parseInt(stock.totalPosition).toLocaleString();
		let lastPrice =
			"$" + latestQuotes[stock.ticker].price.toFixed(1).toLocaleString();
		let dayChange = latestQuotes[stock.ticker].changePercent;
		let totalChange =
			(
				100 *
				((latestQuotes[stock.ticker].price * stock.count) /
					stock.totalPosition -
					1)
			).toFixed(1) + "%";
		formattedHoldings += stock.ticker;
		formattedHoldings += generateSpacing(stock.ticker, 6);
		formattedHoldings += generateSpacing(lastPrice, 9);
		formattedHoldings += lastPrice;
		formattedHoldings += " ";
		formattedHoldings += generateSpacing(dayChange, 6);
		formattedHoldings += dayChange;
		formattedHoldings += " ";
		formattedHoldings += generateSpacing(totalChange, 6);
		formattedHoldings += totalChange;
		formattedHoldings += " ";
		formattedHoldings += generateSpacing(totalPosition, 9);
		formattedHoldings += totalPosition;
		formattedHoldings += " ";
		formattedHoldings += generateSpacing(stock.count, 4);
		formattedHoldings += stock.count;
		formattedHoldings += "\n";
	}
	if (portfolio.holdings.length == 0) {
		formattedHoldings = "this one empty yeet";
	}
	const embed = new RichEmbed()
		.setTitle(":bar_chart: Portfolio summary")
		.setColor(0x2358b3)
		.setDescription(message.author + "```\n" + formattedHoldings + "```")
		.addField(
			":dollar: Cash on hand",
			"$" + portfolio.cash.toLocaleString(),
			true
		)
		.addField(
			":bar_chart: Investments",
			"$" + portfolioSum.toLocaleString(),
			true
		)
		.addField(
			":moneybag: Total equity",
			"$" + (portfolio.cash + portfolioSum).toLocaleString(),
			true
		);
	message.channel.send(embed);
}

async function parseSellCommand(message, params) {
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
	let stockQuote = null;
	let tempMessage = await message.channel.send(
		":incoming_envelope: Processing request..."
	);
	try {
		stockQuote = await market.getLatestStockQuote(ticker);
	} catch (err) {
		let userResponse = "Something went wrong :(";
		switch (err) {
			case "CONNECTION_ERROR":
				userResponse =
					"Woah I can't handle all these requests rn like wait please";
				break;
			case "UNKNOWN_TICKER":
				userResponse = "Wth? " + ticker + " is not a valid stock ticker.";
		}
		tempMessage.delete();
		sendOrderError(message.channel, userResponse);
		return;
	}
	if (!isMarketOpen(stockQuote.marketState)) {
		tempMessage.delete();
		sendOrderError(message.channel, "The markets are closed nerd! Go to bed.");
		return;
	}
	if (stockQuote == null) {
		console.log("Uh something's wrong here...");
		tempMessage.delete();
		return;
	}
	try {
		let orderResult = await database.sellStock(
			message.channel.guild.id,
			message.author.id,
			ticker,
			amount,
			stockQuote.price
		);
		if (orderResult) {
			console.log(orderResult.avgPosition, stockQuote.price);
			let profitPerShare = stockQuote.price - orderResult.avgPosition;
			let profitPercentage =
				100 * (stockQuote.price / orderResult.avgPosition - 1);
			let totalProfit = profitPerShare * orderResult.amountSold;
			let gainsLoss =
				":chart_with_upwards_trend: **Total gains:** $" +
				totalProfit.toLocaleString();
			let messageColor = 0x00ff00;
			if (totalProfit < 0) {
				gainsLoss =
					":chart_with_downwards_trend: **Total loss:** -$" +
					(-totalProfit).toLocaleString();
				messageColor = 0xff0000;
			}
			const embed = new RichEmbed()
				.setTitle(":white_check_mark: Sell order")
				.setColor(messageColor)
				.setDescription(
					`${message.author} sold ${orderResult.amountSold} ${ticker} (${
						stockQuote.changePercent
					}) at $${stockQuote.price}\n${gainsLoss} (${profitPercentage.toFixed(
						2
					)}%)`
				);
			message.channel.send(embed);
		}
	} catch (err) {
		sendOrderError(message.channel, err);
	}
	tempMessage.delete();
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
	let stockQuote = null;
	let tempMessage = await message.channel.send(
		":incoming_envelope: Processing request..."
	);
	try {
		stockQuote = await market.getLatestStockQuote(ticker);
	} catch (err) {
		let userResponse = "Something went wrong :(";
		switch (err) {
			case "CONNECTION_ERROR":
				userResponse =
					"Woah I can't handle all these requests rn like wait please";
				break;
			case "UNKNOWN_TICKER":
				userResponse = "Wth? " + ticker + " is not a valid stock ticker.";
		}
		tempMessage.delete();
		sendOrderError(message.channel, userResponse);
		return;
	}
	if (!isMarketOpen(stockQuote.marketState)) {
		tempMessage.delete();
		sendOrderError(message.channel, "The markets are closed nerd! Go to bed.");
		return;
	}
	if (stockQuote == null) {
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
			stockQuote.price
		);
		if (purchaseSuccessful) {
			const embed = new RichEmbed()
				.setTitle(":white_check_mark: Buy order")
				.setColor(0x00ff00)
				.setDescription(
					`${message.author} purchased ${amount} ${ticker} (${
						stockQuote.changePercent
					}) at $${stockQuote.price}`
				);
			message.channel.send(embed);
		}
	} catch (err) {
		tempMessage.delete();
		sendOrderError(message.channel, err);
		return;
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

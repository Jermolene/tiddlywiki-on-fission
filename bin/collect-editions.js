/*
Collect editions
*/

const fs = require("fs"),
	path = require("path"),
	http = require("http"),
	https = require("https"),
	{promisify} = require("util"),
	readFileAsync = promisify(fs.readFile),
	writeFileAsync = promisify(fs.writeFile),
	puppeteer = require("puppeteer"),
	fetch = require("node-fetch"),
	{ArgParser} = require("./utils");

class App {

	constructor(args) {
		// Parse arguments
		this.args = new ArgParser(args,{
			defaults: {
				"bill-of-materials": "./editions/bill-of-materials.json",
				"output-files": "./app-wiki/output/editions/",
				"output-tiddlers": "./app-wiki/tiddlers/editions"
			}
		});
	}

	async main() {
		// Collect errors rather than failing on the first
		const errors = [];
		// Get arguments
		const bomPath = this.args.byName["bill-of-materials"][0],
			outputFilePath = this.args.byName["output-files"][0],
			outputTiddlersPath = this.args.byName["output-tiddlers"][0];
		// Retrieve and parse the bill of materials
		const bom = JSON.parse(await readFileAsync(bomPath,"utf8"));
		// Go through each entry
		for(const bomEntry of bom) {
			console.log(bomEntry)
			// Read file
			const contents = await this.getFileContents(bomEntry.url);
			// Collect any errors
			if(contents.error) {
				errors.push({bomEntry: bomEntry, error: contents.error});
			} else {
				// Extract information from the template
				const wikiInfo = await this.getWikiInfo(contents.text);
				// Save the file to the output files location
				const outputFileDir = path.resolve(outputFilePath,`./${bomEntry.name}`);
				fs.mkdirSync(outputFileDir,{recursive: true});
				await writeFileAsync(path.resolve(outputFileDir,"./index.html"),contents.text,"utf8");
				// Save the screenshot
				await writeFileAsync(path.resolve(outputFileDir,"./desktop-image.png"),wikiInfo.image);
				// Save the tiddler file
				fs.mkdirSync(outputTiddlersPath,{recursive: true});
				const outputTiddlerFilename = path.resolve(outputTiddlersPath,`./${bomEntry.name}.json`);
				const fields = {
					title: `$:/config/Fission/EditionInfo/${bomEntry.name}`,
					tags: "$:/tags/FissionEditionInfo",
					"thumbnail-path": `${bomEntry.name}/desktop-image.png`,
					"file-path": `${bomEntry.name}/index.html`,
					size: contents.text.length.toString(),
					version: wikiInfo.version || "",
					details: wikiInfo.plugins.map(plugin => `|${plugin.name || "(none)"} |${plugin.version || "(none)"} |${plugin["plugin-type"]} |~${plugin.title} |`).join("\n"),
					name: bomEntry.name,
					text: bomEntry.description
				};
				await writeFileAsync(outputTiddlerFilename,JSON.stringify(fields,null,4),"utf8");
			}
		}
		// Output any errors
		console.log("Errors:",errors)
	}

	async getFileContents(url) {
		if(url === "file://./static-publishing-wiki/output/index.html") {
			// Hack!
			const text = await readFileAsync("./static-publishing-wiki/output/index.html","utf8");
			return {text: text};
		} else {
			// Retrieve the URL contents
			let response, text;
			try {
				response = await fetch(url);
				text = await response.text();
			} catch(e) {
				return {error: e.toString()};
			}
			return {text: text};
		}
	}

	async getWikiInfo(text) {
		// Set up Puppeteer
		const FAKE_URL = "https://example.com/index.html";
		const browser = await puppeteer.launch();
		const page = await browser.newPage();
		await page.setRequestInterception(true);
		page.on("request", async request => {
			if(request.method() === "GET" && request.url() === FAKE_URL) {
				return request.respond({status: 200, contentType: "text/html", body: text});
			} else {
				return request.respond({status: 404, contentType: "text/plain", body: "Not found!"});
			}
		});
		await page.setViewport({
			width: 1280,
			height: 1024,
			deviceScaleFactor: 1,
			isMobile: false,
			hasTouch: false,
			isLandscape: false
		});
		await page.goto(FAKE_URL,{waitUntil: "networkidle2"});
		// Gather output
		const output = {};
		// Get the version number
		output.version = await page.$eval(`meta[name="tiddlywiki-version"]`,el => el.getAttribute("content"));
		// Get the favicon and return it as a URI
		output.favicon = await page.$eval(`link[id="faviconLink"]`,el => el.href);
		// Take screenshot and return it as image file data
		output.image = await page.screenshot({type: "png"});
		// Get information about the loaded plugins
		output.plugins = await page.evaluate(() => {
			return $tw.wiki.filterTiddlers("[has[plugin-type]sort[name]]").filter(title => title !== "$:/temp/info-plugin").map(title => {
				const fields = $tw.wiki.getTiddler(title).fields;
				return {
					title: fields.title,
					name: fields.name,
					description: fields.description,
					version: fields.version,
					"plugin-type": fields["plugin-type"]
				};
			});
		});
		// Shut Puppeteer
		await browser.close();
		return output;
	}
}

const app = new App(process.argv.slice(2));

app.main().then(() => {
	process.exit(0);
}).catch(err => {
	console.error(err);
	process.exit(1);
});

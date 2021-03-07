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
		const errors = [],
			bomPath = this.args.byName["bill-of-materials"][0],
			bom = JSON.parse(await readFileAsync(bomPath,"utf8"));
		for(const bomEntry of bom) {
			console.log(bomEntry)
			// Read file
			const contents = await this.getFileContents(bomEntry.url);
			// Collect any errors
			if(contents.error) {
				errors.push({bomEntry: bomEntry, error: contents.error});
			} else {
				// Extract information from the template
				const wikiInfo = this.getWikiInfo(contents.text);
				console.log(wikiInfo);
				// Save the file to the output files location
				const outputFileDir = path.resolve(this.args.byName["output-files"][0],`./${bomEntry.name}`);
				fs.mkdirSync(outputFileDir,{recursive: true});
				await writeFileAsync(path.resolve(outputFileDir,"./index.html"),contents.text,"utf8");
				// Save the screenshot
				await writeFileAsync(path.resolve(outputFileDir,"./desktop-image.png"),await this.makeScreenshot(bomEntry.url,{
					width: 1280,
					height: 1024,
					deviceScaleFactor: 1,
					isMobile: false,
					hasTouch: false,
					isLandscape: false
				}));
				// Save the tiddler file
				const outputTiddlerDir = this.args.byName["output-tiddlers"][0];
				fs.mkdirSync(outputTiddlerDir,{recursive: true});
				const outputTiddlerFilename = path.resolve(outputTiddlerDir,`./${bomEntry.name}.json`);
				const fields = {
					title: `$:/config/Fission/EditionInfo/${bomEntry.name}`,
					tags: "$:/tags/FissionEditionInfo",
					"thumbnail-path": `${bomEntry.name}/desktop-image.png`,
					"file-path": `${bomEntry.name}/index.html`,
					version: wikiInfo.version || "",
					name: bomEntry.name,
					text: bomEntry.description
				};
				await writeFileAsync(outputTiddlerFilename,JSON.stringify(fields,null,4),"utf8");
			}
		}
	}

	async getFileContents(url) {
		// Retrieve the file contents
		let response, text;
		try {
			response = await fetch(url);
			text = await response.text();
		} catch(e) {
			return {error: e.toString()};
		}
		return {text: text};
	}

	getWikiInfo(text) {
		// Get the version number
		const matchVersion = /<meta name="tiddlywiki\-version" content="([0-9a-z\-\.]+)" \/>/.exec(text);
		return {
			version: matchVersion ? matchVersion[1] : "",
			length: text.length
		}
	}

	async makeScreenshot(url,options) {
		const browser = await puppeteer.launch();
		const page = await browser.newPage();
		await page.setViewport(options);
		await page.goto(url);
		const image = await page.screenshot({
			type: "png"
		});
		await browser.close();
		return image;
	}
}

const app = new App(process.argv.slice(2));

app.main().then(() => {
	process.exit(0);
}).catch(err => {
	console.error(err);
	process.exit(1);
});

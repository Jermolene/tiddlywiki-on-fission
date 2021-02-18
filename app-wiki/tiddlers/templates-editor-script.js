const fissionInit = {
	permissions: {
		app: {
			name: "tiddlywiki-on-fission",
			creator: "jermolene"
		}
	}
};

var fs,permissions;

document.addEventListener("DOMContentLoaded",function(event) {
	initialiseWebnative(function() {
		const params = document.location.hash.slice(1).split("&").map(part => part.split("=")).reduce((accumulator,currentValue) => {
			accumulator[currentValue[0]] = currentValue[1];
			return accumulator;
		},Object.create(null));
		if(!params.path) {
			alert("Missing path");
			return;
		}
		if(fs) {
			loadWiki(params.path).then(function() {
			}).catch(function(err) {
				alert("Error opening wiki: " + err);
			});
		} else {
			alert("Webnative not initialised");
		}
	});
});

function initialiseWebnative(callback) {
	window.webnative.initialize(fissionInit).then(function(state) {
		console.log("state",state)
		switch (state.scenario) {
			case window.webnative.Scenario.AuthSucceeded:
				console.log("webnative.Scenario.AuthSucceeded");
			case window.webnative.Scenario.Continuation:
				console.log("webnative.Scenario.Continuation");
				fs = state.fs;
				permissions = state.permissions;
				console.log("Logged in as",state.username);
				callback();
			  break;
		case window.webnative.Scenario.NotAuthorised:
			console.log("webnative.Scenario.NotAuthorised");
		case window.webnative.Scenario.AuthCancelled:
			console.log("webnative.Scenario.AuthCancelled");
			break;
		}
	});
}

async function loadWiki(filepath) {
	// Try to load the file content
	var iframe = document.getElementsByTagName("iframe")[0];
	if(await fs.exists(filepath)) {
		iframe.srcdoc = await fs.read(filepath);
	} else {
		// Make an empty wiki template by inception
		iframe.srcdoc = "Not found: " + filepath;
	}
	window.addEventListener("message",function(event) {
		if(event.data.verb === "NOTIFY" && event.data.url === "pagetitle") {
			document.title = event.data.body;
		}
		if(event.data.verb === "SAVE") {
			fs.write(filepath,event.data.body).then(function() {
				fs.publish().then(function() {
					console.log("Successfully saved wiki");
				});
			}).catch(function(err) {
				alert("Saving error: " + err);
			});
		}
		console.log("Got event from child wiki",event);
	});
}

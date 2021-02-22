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
			loadWiki(params.path,function(err) {
				if(err) {
					document.getElementById("banner").hidden = false;
					console.log("Load wiki status: " + status);
				}
			}).then(function() {
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

async function loadWiki(filepath,initialisationHandler) {
	const iframe = document.getElementsByTagName("iframe")[0];
	// Set up the message channel for talking to the iframe
	iframe.addEventListener("load",function() {
		// Subscribe to saving messages
		var saveSubscriber = new messaging.BrowserMessagingSubscriber({
				target: iframe.contentWindow,
				type: "SAVE",
				onsubscribe: function(err) {
					initialisationHandler(err);
				},
				onmessage: function(data,callback) {
					console.log("Would be saving to ",filepath);
					fs.write(filepath,data.body).then(function() {
						fs.publish().then(function() {
							callback({verb: "OK"});
						});
					}).catch(function(err) {
						callback({verb: "ERROR", message: "Saving error: " + err});
					});
				}
			});
		// Subscribe to title changes
		var titleSubscriber = new messaging.BrowserMessagingSubscriber({
				target: iframe.contentWindow,
				type: "PAGETITLE",
				onmessage: function(data,callback) {
					document.title = data.body;
					return callback({verb: "OK"});
				}
			});
		// Subscribe to favicon changes
		var faviconSubscriber = new messaging.BrowserMessagingSubscriber({
				target: iframe.contentWindow,
				type: "FAVICON",
				onmessage: function(data,callback) {
					var faviconLink = document.getElementById("faviconLink");
					faviconLink.setAttribute("href",data.body);
					return callback({verb: "OK"});
				}
			});
	});
	// Try to load the file content
	if(await fs.exists(filepath)) {
		iframe.srcdoc = await fs.read(filepath);
	} else {
		// Grab an empty wiki
		const response = await fetch("empty.html");
		if(response.ok && response.status === 200) {
			iframe.srcdoc = await response.text();
		} else {
			iframe.srcdoc = "Cannot load empty.html";
		}
	}
}

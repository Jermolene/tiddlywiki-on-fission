/*
This script is run as part of the editor loader, and doesn't run under TiddlyWiki
*/

(function() {

"use strict";

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

async function loadWiki(userFilepath,initialisationHandler) {
	const realFilepath = convertUserFilepath(userFilepath);
	console.log(`Loading wiki from userpath ${userFilepath} (absolute path ${realFilepath})`);
	const iframe = document.getElementsByTagName("iframe")[0];
	// Set up the message channel for talking to the iframe
	iframe.addEventListener("load",function() {
		// Subscribe to saving messages
		enableSaving(iframe.contentDocument,function(text,callback) {
			console.log("Saving to: " + realFilepath)
			fs.write(realFilepath,text).then(function() {
				fs.publish().then(function() {
					callback(null);
				});
			}).catch(function(err) {
				callback("Saving error: " + err);
			});
		});
		// Observe mutations of the title element of the iframe
		var extractTitle = function() {
				window.document.title = iframe.contentDocument.title;
			},
			titleObserver = new MutationObserver(extractTitle),
			iframeTitleNode = iframe.contentDocument.getElementsByTagName("title")[0];
		extractTitle();
		titleObserver.observe(iframeTitleNode,{attributes: true, childList: true, characterData: true});
		// Observe mutations of the favicon element of the iframe
		var faviconLink = iframe.contentDocument.getElementById("faviconLink"),
			hostFaviconLink = document.getElementById("faviconLink"),
			extractFavicon = function() {
				hostFaviconLink.setAttribute("href",faviconLink.getAttribute("href"));
			},
			faviconObserver = new MutationObserver(extractFavicon);
		if(faviconLink) {
			extractFavicon();
			faviconObserver.observe(faviconLink,{attributes: true, childList: true, characterData: true});		
		}
	});
	// Try to load the file content
	if(await fs.exists(realFilepath)) {
		iframe.srcdoc = await fs.read(realFilepath);
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

/*
Convert a user-facing path to a real absolute path by replacing `private/` with the app folder
*/
function convertUserFilepath(userFilepath) {
	if(fs && userFilepath.startsWith("private")) {
		return fs.appPath() + userFilepath.slice("private".length);
	} else {
		return userFilepath;
	}
}


// Helper to enable TiddlyFox-style saving for a window
function enableSaving(doc,fnSaveFile) {
	// Create the message box
	var messageBox = doc.createElement("div");
	messageBox.id = "tiddlyfox-message-box";
	doc.body.appendChild(messageBox);
	// Listen for save events
	messageBox.addEventListener("tiddlyfox-save-file",function(event) {
		// Get the details from the message
		var message = event.target,
			filepath = message.getAttribute("data-tiddlyfox-path"),
			content = message.getAttribute("data-tiddlyfox-content");
		// Save the file
		fnSaveFile(content,function(err) {
			if(err) {
				alert("Error saving file: " + err);
			}
			// Remove the message element from the message box
			message.parentNode.removeChild(message);
			// Send a confirmation message
			var event = doc.createEvent("Events");
			event.initEvent("tiddlyfox-have-saved-file",true,false);
			event.savedFilePath = filepath;
			message.dispatchEvent(event);
		});
		return false;
	},false);
}

/*
Pad a string to a given length with "0"s. Length defaults to 2
*/
function pad(value,length) {
	length = length || 2;
	var s = value.toString();
	if(s.length < length) {
		s = "000000000000000000000000000".substr(0,length - s.length) + s;
	}
	return s;
};

/*
 * Returns an escape sequence for given character. Uses \x for characters <=
 * 0xFF to save space, \u for the rest.
 *
 * The code needs to be in sync with th code template in the compilation
 * function for "action" nodes.
 */
// Copied from peg.js, thanks to David Majda
function escapeChar(ch) {
	var charCode = ch.charCodeAt(0);
	if(charCode <= 0xFF) {
		return '\\x' + pad(charCode.toString(16).toUpperCase());
	} else {
		return '\\u' + pad(charCode.toString(16).toUpperCase(),4);
	}
};

// Turns a string into a legal JavaScript string
// Copied from peg.js, thanks to David Majda
function stringify(s) {
	/*
	* ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a string
	* literal except for the closing quote character, backslash, carriage return,
	* line separator, paragraph separator, and line feed. Any character may
	* appear in the form of an escape sequence.
	*
	* For portability, we also escape all non-ASCII characters.
	*/
	return (s || "")
		.replace(/\\/g, '\\\\')            // backslash
		.replace(/"/g, '\\"')              // double quote character
		.replace(/'/g, "\\'")              // single quote character
		.replace(/\r/g, '\\r')             // carriage return
		.replace(/\n/g, '\\n')             // line feed
		.replace(/[\x00-\x1f\x80-\uFFFF]/g, escapeChar); // non-ASCII characters
};

})();

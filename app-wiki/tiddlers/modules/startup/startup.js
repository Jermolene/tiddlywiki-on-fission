/*\
title: $:/plugins/tiddlywiki/fission/startup.js
type: application/javascript
module-type: startup

TiddlyWiki startup module to initialise Fission

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

// Export name and synchronous status
exports.name = "fission";
exports.after = ["startup"];
exports.platforms = ["browser"];
exports.synchronous = false;

const fissionInit = {
	permissions: {
		app: {
			name: 'tiddlywiki-on-fission',
			creator: 'jermolene'
		}
	}
};

exports.startup = function(callback) {
	var fs, permissions;
	$tw.fission = new Fission();
	$tw.fission.initialise(callback);
}

function Fission() {
	this.fs = null;
	this.permissions = null;
	this.webnative = require("$:/plugins/tiddlywiki/fission/webnative.js");
	this.windows = [];
}

Fission.prototype.initialise = function(callback) {
	var self = this;
	$tw.rootWidget.addEventListener("tm-fission-authorise",function(event) {
		if(fs && permissions) {
		  self.webnative.redirectToLobby(self.permissions);
		}
		return false;
	});
	$tw.rootWidget.addEventListener("tm-fission-open-tiddlywiki",function(event) {
		if(self.fs && self.permissions) {
			// Open the wiki
			var domLink = document.createElement("a");
			domLink.setAttribute("href","/editor.html#path=" + event.param);
			domLink.setAttribute("target","_blank");
			domLink.setAttribute("rel","noopener noreferrer");
			document.body.appendChild(domLink);
			domLink.click();
			document.body.removeChild(domLink);
		}
		return false;
	});
	// Close open windows when unloading main window
	$tw.addUnloadTask(function() {
		$tw.utils.each(self.windows,function(win) {
			win.close();
		});
	});
	this.webnative.initialize(fissionInit).then(function(state) {
		console.log("state",state)
		switch (state.scenario) {
			case self.webnative.Scenario.AuthSucceeded:
				console.log("webnative.Scenario.AuthSucceeded");
			case self.webnative.Scenario.Continuation:
				console.log("webnative.Scenario.Continuation");
				self.fs = state.fs;
				self.permissions = state.permissions;
				$tw.wiki.addTiddler({title: "$:/status/UserName", text: state.username});
				(async function() {
					// Check the app directory exists
					const appPath = self.fs.appPath();
					const appDirectoryExists = await self.fs.exists(appPath);
					if (!appDirectoryExists) {
						await self.fs.mkdir(appPath);
						await self.fs.publish();
					}
				})().then(callback);
			  break;
		case self.webnative.Scenario.NotAuthorised:
			console.log("webnative.Scenario.NotAuthorised");
		case self.webnative.Scenario.AuthCancelled:
			console.log("webnative.Scenario.AuthCancelled");
			$tw.wiki.addTiddler({title: "$:/status/UserName", text: "(none)"});
			callback();
			break;
		}
	});
};

})();

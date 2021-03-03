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
		if(self.permissions) {
		  self.webnative.redirectToLobby(self.permissions);
		}
		return false;
	});
	$tw.rootWidget.addEventListener("tm-fission-list-directory",function(event) {
		if(self.fs && self.permissions) {
			const userFilepath = event.param, // The filepath seen by users (private is relative to app folder)
				realFilepath = self.convertUserFilepath(event.param); // The read underlying absolute filepath
			self.fs.ls(realFilepath).then(function(data) {
				$tw.utils.each(Object.keys(data),function(name) {
					var info = data[name];
					$tw.wiki.addTiddler({
						title: "$:/temp/fission/filesystem/" + userFilepath + "/" + name,
						tags: "$:/tags/FissionFileListing",
						parent: userFilepath,
						name: name,
						path: userFilepath + "/" + name,
						created: info.mtime ? $tw.utils.stringifyDate(new Date(info.mtime)) : undefined,
						size: info.size.toString(),
						"is-file": info.isFile ? "yes" : "no"
					})
				});
				console.log("List",data);
			}).catch(function(err) {
				alert("List directory error: " + err)
			});
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
	// Helper to set the username if it has changed
	var setUserName = function(username) {
		username = username || "";
		if($tw.wiki.getTiddlerText("$:/state/UserName","") !== username) {
			$tw.wiki.addTiddler({title: "$:/state/UserName", text: username});
		}
	};
	// Initialise webnative
	this.webnative.initialize(fissionInit).then(function(state) {
		console.log("state",state)
		self.permissions = state.permissions;
		switch (state.scenario) {
			case self.webnative.Scenario.AuthSucceeded:
				console.log("webnative.Scenario.AuthSucceeded");
			case self.webnative.Scenario.Continuation:
				console.log("webnative.Scenario.Continuation");
				self.fs = state.fs;
				setUserName(state.username);
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
			setUserName("");
			callback();
			break;
		}
	});
};

/*
Convert a user-facing path to a real absolute path by replacing `private/` with the app folder
*/
Fission.prototype.convertUserFilepath = function(userFilepath) {
	if(this.fs && userFilepath.startsWith("private")) {
		return this.fs.appPath() + userFilepath.slice("private".length);
	} else {
		return userFilepath;
	}
}

})();

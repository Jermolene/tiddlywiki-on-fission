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

exports.startup = function(callback) {
	$tw.fission = new Fission();
	$tw.fission.initialise(callback);
}

function Fission() {
	this.fs = null;
	this.permissions = null;
	this.username = null;
	this.webnative = require("$:/plugins/tiddlywiki/fission/webnative.js");
	this.webnative.setup.debug({ enabled: true });
	this.windows = [];
	this.setStatus("INITIALISING");
}

Fission.prototype.setStatus = function(status) {
	$tw.wiki.addTiddler({title: "$:/state/fission/status",text: status});
};

Fission.prototype.initialise = function(callback) {
	var self = this;
	$tw.rootWidget.addEventListener("tm-fission-authorise",function(event) {
		if(self.permissions) {
		  self.webnative.redirectToLobby(self.permissions);
		}
		return false;
	});
	$tw.rootWidget.addEventListener("tm-fission-leave",function(event) {
		self.webnative.leave(function(err) {
			console.log("webnative.leave() returned",err);
			self.setUserName();
		});
		return false;
	});
	$tw.rootWidget.addEventListener("tm-fission-list-directory",function(event) {
		if(self.fs && self.permissions && event.paramObject && event.paramObject.path) {
			const userFilepath = self.cleanPath(event.paramObject.path),
				systemFilepath = self.convertUserDirpathToSystemDirpath(userFilepath),
				resultPrefix = event.paramObject.resultPrefix || ("$:/temp/fission/filesystem/" + userFilepath + "/"),
				statusTitle = event.paramObject.statusTitle;
			if(statusTitle) {
				$tw.wiki.addTiddler({title: statusTitle, text: "PENDING"});
			}
			self.fs.ls(systemFilepath).then(function(data) {
					if(statusTitle) {
						$tw.wiki.addTiddler({title: statusTitle, text: "FINISHED"});
					}
					$tw.utils.each(Object.keys(data),function(name) {
					var info = data[name],
						userFilepathString = userFilepath.join("/");
					$tw.wiki.addTiddler({
						title: resultPrefix + name,
						tags: "$:/tags/FissionFileListing",
						parent: userFilepathString,
						name: name,
						path: userFilepathString + "/" + name,
						"public-path": userFilepath[0] === "public" ? ("https://" + self.username + ".files.fission.name/p/" + userFilepath.slice(1).concat(name).join("/")) : undefined,
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
			const filepath = self.cleanPath(event.param).join("/");
			var params = [`path=${filepath}`];
			if(event.paramObject && event.paramObject.edition) {
				const editionURL = event.paramObject.edition;
				params.push(`edition=${editionURL}`);
			}
			domLink.setAttribute("href","/editor.html#" + params.join("&"));
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
	// Initialise webnative
	const fissionInit = {
		permissions: {
			app: {
				name: 'tiddlywiki-on-fission',
				creator: 'tiddlywiki'
			},
			fs: {
				public: [ this.webnative.path.root() ]
			}
		}
	};
	this.webnative.initialize(fissionInit).then(function(state) {
		console.log("state",state)
		self.permissions = state.permissions;
		switch (state.scenario) {
			case self.webnative.Scenario.AuthSucceeded:
				console.log("webnative.Scenario.AuthSucceeded");
			case self.webnative.Scenario.Continuation:
				console.log("webnative.Scenario.Continuation");
				self.setStatus("AUTHORISED");
				self.fs = state.fs;
				self.username = state.username;
				self.setUserName(state.username);
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
			self.setStatus("NOTAUTHORISED");
			self.setUserName("");
			callback();
			break;
		}
	});
};

// Helper to set the username if it has changed
Fission.prototype.setUserName = function(username) {
	username = username || "";
	if($tw.wiki.getTiddlerText("$:/state/UserName","") !== username) {
		$tw.wiki.addTiddler({title: "$:/state/UserName", text: username});
	}
};

/*
Clean up a path by removing leading and trailing slashes and returning the parts as an array
*/
Fission.prototype.cleanPath = function(filepath) {
	return filepath.split("/").filter(part => part !== "");
}

/*
Convert a user-facing path to a real absolute path by replacing `private/` with the app folder
*/
Fission.prototype.convertUserDirpathToSystemDirpath = function(userFilepathParts) {
	let root;
	switch(userFilepathParts[0]) {
		case "private":
			root = this.fs.appPath().directory;
			break;
		case "public":
			root = [this.webnative.path.Branch.Public];
			break;
		case "pretty":
			root = [this.webnative.path.Branch.Pretty];
			break;
		default:
			userFilepathParts.unshift("private");
			root = [this.webnative.path.Branch.Private];
			break;
	}
	return this.webnative.path.directory.apply(null,root.concat(userFilepathParts.slice(1)));
}

})();

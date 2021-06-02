/*\
title: $:/plugins/tiddlywiki/tiddlywiki-on-fission/fission-publisher.js
type: application/javascript
module-type: library

Handles publishing to Fission Webnative filing system

\*/
(function(){

if(module.setStringHandler) {
	module.setStringHandler(function(name,language) {
		switch(name) {
			case "ui":
				return "User interface of the Fission publisher\n\nOutput base path: <$edit-text field=fission-output-path default='public/'/>";
		}
		return null;
	});
}

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

exports.name = "fission";

exports.create = function(params) {
	var webnativeDetails = window.webnativeDetails || window.parent && window.parent.webnativeDetails;
	if(webnativeDetails) {
		return new FissionPublisher(params,webnativeDetails);		
	} else {
		return null;
	}
};

function FissionPublisher(params,webnativeDetails) {
	this.webnativeDetails = webnativeDetails;
	this.params = params;
	this.outputBasePath = params["fission-output-path"] || "public/";
	console.log("FissionPublisher",params);
};

FissionPublisher.prototype.publishStart = function(callback) {
	console.log("publishStart");
	callback([]);
};

FissionPublisher.prototype.publishFile = function(item,callback) {
	var path = this.outputBasePath + item.path
	this.webnativeDetails.fs.add(path,item.text).then(function() {
		console.log(`Saved to ${path}`);
		callback();
	}).catch(function(err) {
		alert(`Error saving file ${path} to fission: ${err}`);
		callback();
	});
};

FissionPublisher.prototype.publishEnd = function(callback) {
	this.webnativeDetails.fs.publish().then(function() {
		alert(`Published`);
		callback();
	}).catch(function(err) {
		alert(`Error publishing to fission: ${err}`);
		callback();
	});
};

})();

/**
 * This includes code from https://github.com/unscriptable/cssx
 * Copyright (c) 2010 unscriptable.com
 */

/*jslint browser:true, on:true, sub:true */

define([
	"requirejs-dplugins/has",
	"dcl/dcl",
	"module"
], function (has, dcl, module) {
	"use strict";

	/*
	 * AMD css! plugin
	 * This plugin will load and wait for css files.  This could be handy when
	 * loading css files as part of a layer or as a way to apply a run-time theme.
	 * Most browsers do not support the load event handler of the link element.
	 * Therefore, we have to use other means to detect when a css file loads.
	 * (The HTML5 spec states that the LINK element should have a load event, but
	 * not even Chrome 8 or FF4b7 have it, yet.
	 * http://www.w3.org/TR/html5/semantics.html#the-link-element)
	 *
	 * This plugin tries to use the load event and a universal work-around when
	 * it is invoked the first time.  If the load event works, it is used on
	 * every successive load.  Therefore, browsers that support the load event will
	 * just work (i.e. no need for hacks!).  FYI, Feature-detecting the load
	 * event is tricky since most browsers have a non-functional onload property.
	 *
	 * The universal work-around watches a stylesheet until its rules are
	 * available (not null or undefined).  There are nuances, of course, between
	 * the various browsers.  The isLinkReady function accounts for these.
	 *
	 * Note: it appears that all browsers load @import'ed stylesheets before
	 * fully processing the rest of the importing stylesheet. Therefore, we
	 * don't need to find and wait for any @import rules explicitly.
	 *
	 * Note #2: for Opera compatibility, stylesheets must have at least one rule.
	 * AFAIK, there's no way to tell the difference between an empty sheet and
	 * one that isn't finished loading in Opera (XD or same-domain).
	 *
	 * Global configuration options:
	 *
	 * cssWatchPeriod: if direct load-detection techniques fail, this option
	 * determines the msec to wait between brute-force checks for rules. The
	 * default is 50 msec.
	 *
	 * You may specify an alternate file extension:
	 *      require('css!myproj/component.less') // --> myproj/component.less
	 *      require('css!myproj/component.scss') // --> myproj/component.scss
	 *
	 * When using alternative file extensions, be sure to serve the files from
	 * the server with the correct mime type (text/css) or some browsers won't
	 * parse them, causing an error in the plugin.
	 *
	 * usage:
	 *      require(['css!myproj/comp']); // load and wait for myproj/comp.css
	 *      define(['css!some/folder/file'], {}); // wait for some/folder/file.css
	 *
	 * Tested in:
	 *      Firefox 28+
	 *      Safari 6+
	 *      Chrome 33+
	 *      IE 9+
	 *      Android 4.x
	 */


	var
	// failed is true if RequireJS threw an exception
		failed = false,
		cache = {},
		lastInsertedLink,
		head = document && (document.head || document.getElementsByTagName("head")[0]);

	has.add("event-link-onload", function (global) {
		var wk = navigator.userAgent.match(/AppleWebKit\/([\d.]+)/);
		return global.document && global.document.createElement("link").onload === null
			// PR: needed for webkit browser (actually Android Stock Browser...)
			&& wk && (parseInt(wk[1])>535);
	});

	console.log("has(event-link-onload): " + has("event-link-onload"));

	function createLink() {
		var link = document.createElement("link");
		link.rel = "stylesheet";
		link.type = "text/css";
		return link;
	}

	function nameWithExt(name, defaultExt) {
		return (/\.[^/]*$/.test(name)) ? name : name + "." + defaultExt;
	}

	var loadDetector = function (params, cb) {
		// failure detection
		// we need to watch for onError when using RequireJS so we can shut off
		// our setTimeouts when it encounters an error.
		if (require.onError) {
			require.onError = (function (orig) {
				return function () {
					failed = true;
					orig.apply(this, arguments);
				};
			})(require.onError);
		}

		/***** load-detection functions *****/

		function loadHandler(params, cb) {
			// We're using "readystatechange" because IE and Opera happily support both
			var link = params.link;
			link.onreadystatechange = link.onload = function () {
				if (!link.readyState || link.readyState === "complete") {
					console.log("##### event-link-onload is really true !!!");
					has.add("event-link-onload", true, true, true);
					cleanup(params);
					cb(params);
				}
			};
		}

		// alternative path for browser with broken link-onload

		function isLinkReady(link) {
			// based on http://www.yearofmoo.com/2011/03/cross-browser-stylesheet-preloading.html
			// Therefore, we need
			// to continually test beta browsers until they all support the LINK load
			// event like IE and Opera.
			// webkit's and IE's sheet is null until the sheet is loaded
			var sheet = link.sheet || link.styleSheet;
			if (sheet) {
				var styleSheets = document.styleSheets;
				for (var i = styleSheets.length; i > 0; i--) {
					if (styleSheets[i - 1] === sheet) {
						return true;
					}
				}
			}
		}

		function ssWatcher(params, cb) {
			// watches a stylesheet for loading signs.
			if (isLinkReady(params.link)) {
				cleanup(params);
				cb(params);
			}
			else if (!failed) {
				setTimeout(function () {
					ssWatcher(params, cb);
				}, params.wait);
			}
		}

		function cleanup(params) {
			var link = params.link;
			link.onreadystatechange = link.onload = null;
		}

		// It would be nice to use onload everywhere, but the onload handler
		// only works in IE and Opera.
		// Detecting it cross-browser is completely impossible, too, since
		// THE BROWSERS ARE LIARS! DON'T TELL ME YOU HAVE AN ONLOAD PROPERTY
		// IF IT DOESN'T DO ANYTHING!
		var loaded;

		function cbOnce() {
			if (!loaded) {
				loaded = true;
				cb(params);
			}
		}

		loadHandler(params, cbOnce);
		if (!has("event-link-onload")) {
			console.log("### try ssWatcher path...");
			ssWatcher(params, cbOnce);
		}
	};

	/***** finally! the actual plugin *****/
	return {

		load: function (resourceDef, require, callback) {
			var resources = resourceDef.split(","),
				config = module.config(),
				loadingCount = resources.length,

			// all detector functions must ensure that this function only gets
			// called once per stylesheet!
				loaded = function (params) {
					// load/error handler may have executed before stylesheet is
					// fully parsed / processed in Opera, so use setTimeout.
					// Opera will process before the it next enters the event loop
					// (so 0 msec is enough time).
					var cached = cache[params.url];
					cached.s = "loaded";
					var cbs = cached.cbs;
					delete cached.cbs;
					if (cbs) {
						cbs.forEach(function (f) { f(); });
					}
					// if all stylesheets have been loaded, then call the plugin callback
					if (--loadingCount === 0) {
						callback(link.sheet || link.styleSheet);
					}
				};

			// after will become truthy once the loop executes a second time
			for (var i = 0, after; i < resources.length; i++, after = url) {
				resourceDef = resources[i];
				var
					name = resourceDef,
					url = nameWithExt(require["toUrl"](name), "css"),
					link = createLink(),
				// TODO PR: should we still support these options ?
					params = {
						link: link,
						url: url,
						wait: config && config.cssWatchPeriod || 25
					},
					cached = cache[url];
				if (cached) {
					switch (cached.s) {
					case "loaded":
						loaded(params);
						console.log(url + " has already been loaded");
						continue;
					case "injected":
						// if the link has been injected in a previous load() call but not yet loaded,
						// we register the loaded callback of this module to get called when the injected css will be
						// loaded, and process the next resourceDef, if any.
						var f = loaded.bind(this, params);
						cached.cbs ? cached.cbs.push[f] : (cached.cbs = [f]);
						continue;
					}
				}
				cache[params.url] = {s: "injected"};
				// hook up load detector(s)
				loadDetector(params, loaded);
				// go!
				link.href = url;
				head.insertBefore(link, lastInsertedLink ? lastInsertedLink.nextSibling : head.firstChild);
				lastInsertedLink = link;
			}
		}
	};
});

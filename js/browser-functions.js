/// <reference path="../../typings/index.d.ts"/>
// MV3: Check for APIs without relying on window object (may not exist in service worker)
var IS_SAFARI = (typeof (safari) != "undefined");
var IS_CHROME = (typeof (chrome) != "undefined");
//var IS_OPERA = (typeof navigator !== "undefined" && navigator.vendor) ? navigator.vendor.indexOf("Opera") != -1 : false;
var SAFARI_UPDATE_MANIFEST = SAFARI_UPDATE_MANIFEST;

// Manifest V3: chrome.tabs.sendMessage is the standard API
// No need for compatibility shim in V3

var extension;
(function (extension) {
    var _locales = {};
    var _version = null;
    
    function getExtensionVersion() {
        if (_version != null)
            return _version;
        
        if (IS_SAFARI) {
            var r = new XMLHttpRequest();
            r.open("GET", "Info.plist", false);
            r.send(null);
            var data = r.responseText;
            var currentVersion;
            // MV3: Check for $ before using
            if (typeof $ !== "undefined") {
                $.each($(data).find("key"), function (index, key) {
                    if ($(key).text() == 'CFBundleShortVersionString') {
                        currentVersion = $(key).next().text();
                    }
                });
            }
            _version = currentVersion;
        }
        else if (IS_CHROME) {
            var manifest = chrome.runtime.getManifest();
            _version = manifest.version;
        }
        return _version;
    }
    extension.getExtensionVersion = getExtensionVersion;
    
    function setBadge(value) {
        if (IS_SAFARI) {
            var toolbarItems = safari.extension.toolbarItems;
            for (var i = 0; i < toolbarItems.length; i++) {
                if (toolbarItems[i].identifier == "toolbarButton")
                    toolbarItems[i].badge = value;
            }
        }
        else if (IS_CHROME) {
            var text = value === 0 ? "" : value.toString();
            // Manifest V3: Use action instead of browserAction
            chrome.action.setBadgeBackgroundColor({ color: [0, 200, 0, 100] });
            chrome.action.setBadgeText({ text: text });
        }
    }
    extension.setBadge = setBadge;
    
    // Manifest V3: getBackgroundPage doesn't work with service workers
    // Use chrome.runtime.sendMessage instead for communication
    function getBackgroundPage() {
        var backgroundPage;
        if (IS_SAFARI) {
            backgroundPage = safari.extension.globalPage.contentWindow;
        }
        else if (IS_CHROME) {
            // V3: Return null - service workers don't have a background page window
            // Use message passing instead
            backgroundPage = null;
        }
        return backgroundPage;
    }
    extension.getBackgroundPage = getBackgroundPage;
    
    function getLocalizedString(messageName) {
        if (IS_SAFARI) {
            return safari.extension.localization[messageName];
        }
        else if (IS_CHROME) {
            return chrome.i18n.getMessage(messageName);
        }
        return messageName;
    }
    extension.getLocalizedString = getLocalizedString;
    
    function getResourceURL(resourceName) {
        if (IS_SAFARI) {
            return safari.extension.baseURI + resourceName;
        }
        else if (IS_CHROME) {
            return chrome.runtime.getURL(resourceName);
        }
        return resourceName;
    }
    extension.getResourceURL = getResourceURL;
    
})(extension || (extension = {}));

// Storage namespace - no changes needed for V3
var extension;
(function (extension) {
    var storage;
    (function (storage) {
        function set(object, callback) {
            if (IS_SAFARI) {
                for (var key in object) {
                    try {
                        var json = JSON.stringify(object[key]);
                        safari.extension.secureSettings.setItem(key, json);
                    }
                    catch (exception) {
                        console.warn("Error while storing item with key %s", key);
                    }
                }
                if (callback) {
                    callback();
                }
            }
            if (IS_CHROME) {
                chrome.storage.local.set(object, callback);
            }
        }
        storage.set = set;
        
        function get(keys, callback) {
            if (!Array.isArray(keys)) {
                var key = keys;
                keys = [key];
            }
            if (IS_SAFARI) {
                var result = {};
                for (var i = 0; i < keys.length; i++) {
                    try {
                        var json = safari.extension.secureSettings.getItem(keys[i]);
                        result[keys[i]] = JSON.parse(json);
                    }
                    catch (exception) {
                        console.log("Error while retrieving storage item with key %s", keys[i]);
                        result[keys[i]] = null;
                    }
                }
                callback(result);
            }
            if (IS_CHROME) {
                chrome.storage.local.get(keys, function (storageItems) {
                    if (!storageItems) {
                        storageItems = {};
                    }
                    for (var i = 0; i < keys.length; i++) {
                        if (typeof storageItems[keys[i]] === "undefined")
                            storageItems[keys[i]] = null;
                    }
                    callback(storageItems);
                });
            }
        }
        storage.get = get;
        
        function remove(keys, callback) {
            if (!Array.isArray(keys)) {
                var key = keys;
                keys = [key];
            }
            if (IS_SAFARI) {
                for (var i = 0; i < keys.length; i++) {
                    safari.extension.secureSettings.removeItem(keys[i]);
                }
                if (callback) {
                    callback();
                }
            }
            if (IS_CHROME) {
                chrome.storage.local.remove(keys, callback);
            }
        }
        storage.remove = remove;
        
        function clear(callback) {
            if (IS_SAFARI) {
                safari.extension.secureSettings.clear();
                if (callback) {
                    callback();
                }
            }
            if (IS_CHROME) {
                chrome.storage.local.clear(callback);
            }
        }
        storage.clear = clear;
        
        function addEventListener(eventHandler) {
            if (IS_SAFARI) {
                if (!safari.extension.secureSettings)
                    return;
                var cachedChanges = {};
                safari.extension.secureSettings.addEventListener("change", function (event) {
                    if (event.oldValue != event.newValue) {
                        if (Object.keys(cachedChanges).length == 0) {
                            setTimeout(function () {
                                eventHandler(cachedChanges);
                                cachedChanges = {};
                            }, 1000);
                        }
                        cachedChanges[event.key] = { oldValue: event.oldValue, newValue: event.newValue };
                    }
                }, false);
            }
            if (IS_CHROME) {
                chrome.storage.onChanged.addListener(function (changes, areaName) {
                    if (areaName == "local") {
                        eventHandler(changes);
                    }
                });
            }
        }
        storage.addEventListener = addEventListener;
    })(storage = extension.storage || (extension.storage = {}));
})(extension || (extension = {}));

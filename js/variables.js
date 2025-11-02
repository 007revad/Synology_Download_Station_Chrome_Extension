// MV3: Removed window dependency - navigator may be undefined in service worker context
var IS_SAFARI = (typeof (safari) != "undefined");
var IS_CHROME = (typeof (chrome) != "undefined");
// Manifest V3: navigator.vendor may be undefined in service worker context at startup
//var IS_OPERA = (typeof navigator !== "undefined" && navigator.vendor) ? navigator.vendor.indexOf("Opera") != -1 : false;
//var DONATION_URL = "http://www.download-station-extension.com/donate";
var DONATION_URL = "https://buymeacoffee.com/007revad";
var DONATION_URL2 = "https://www.paypal.me/007revad";
//var SAFARI_UPDATE_MANIFEST = "https://www.download-station-extension.com/downloads/safari-extension-updatemanifest.plist";
//var DONATION_CHECK_URL = "https://www.download-station-extension.com/donate/check_email";

// Disable Google Analytics
try {
    if (typeof localStorage !== "undefined" && localStorage["disableGA"] == "true") {
        // MV3: window may not be available in service worker context
        if (typeof window !== "undefined") {
            window["_gaUserPrefs"] = { ioo: function () { return true; } };
        }
    }
}
catch (exc) { }

// String and Array prototype extensions
if (typeof String !== "undefined" && String.prototype) {
    String.prototype.extractUrls = function () {
        var text = this;
        var patt = new RegExp("(https?|magnet|thunder|flashget|qqdl|s?ftps?|ed2k)(://|:?)\\S+", "ig");
        var urls = new Array();
        do {
            var result = patt.exec(text);
            if (result != null) {
                var url = result[0];
                if (url.charAt(url.length - 1) == ",")
                    url = url.substring(0, url.length - 1);
                urls.push(result[0]);
            }
        } while (result != null);
        if (urls.length > 0)
            return urls;
        else
            return [text];
    };
}

if (typeof Array !== "undefined" && Array.prototype) {
    Array.prototype.contains = function (item) {
        for (var i = 0; i < this.length; i++) {
            if (this[i] == item) return true;
        }
        return false;
    };
}

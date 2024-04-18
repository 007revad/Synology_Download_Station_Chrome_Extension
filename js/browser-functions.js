/// <reference path="../../typings/index.d.ts"/>
var IS_SAFARI = (typeof (safari) != "undefined");
var IS_CHROME = (typeof (chrome) != "undefined");
var IS_OPERA = navigator.vendor.indexOf("Opera") != -1;
var SAFARI_UPDATE_MANIFEST = SAFARI_UPDATE_MANIFEST;
if (IS_CHROME && chrome.tabs && !chrome.tabs.sendMessage) {
    chrome.tabs.sendMessage = chrome.tabs.sendRequest;
}
var extension;
(function (extension) {
    var _locales = {};
    var _version = null;
    function getExtensionVersion() {
        if (_version != null)
            return _version;
        // Safari
        if (IS_SAFARI) {
            var r = new XMLHttpRequest();
            r.open("GET", "Info.plist", false);
            r.send(null);
            var data = r.responseText;
            var currentVersion;
            $.each($(data).find("key"), function (index, key) {
                if ($(key).text() == 'CFBundleShortVersionString') {
                    currentVersion = $(key).next().text();
                }
            });
            _version = currentVersion;
        }
        else if (IS_CHROME) {
            var manifest = chrome.runtime.getManifest();
            _version = manifest.version;
        }
        return _version;
    }
    extension.getExtensionVersion = getExtensionVersion;
    function getExtensionBundleVersion() {
        var r = new XMLHttpRequest();
        r.open("GET", extension.getResourceURL("Info.plist"), false);
        r.send(null);
        var data = r.responseText;
        var currentVersion;
        $.each($(data).find("key"), function (index, key) {
            if ($(key).text() == 'CFBundleVersion') {
                currentVersion = parseInt($(key).next().text());
            }
        });
        return currentVersion;
    }
    extension.getExtensionBundleVersion = getExtensionBundleVersion;
    function getLocalizedString(name, substitutions, language) {
        if (!Array.isArray(substitutions)) {
            substitutions = new Array();
        }
        // Safari
        if (IS_SAFARI) {
            if (!language) {
                language = _getBrowserLanguage();
            }
            var locale = _getLocale(language);
            if (locale !== null && typeof locale[name] === 'object' && typeof locale[name].message === 'string') {
                return prepareLocalizedMessage(locale[name], substitutions);
            }
            else if (language.split('_').length == 2) {
                return getLocalizedString(name, substitutions, language.split('_')[0]);
            }
            else if (language != "en") {
                console.warn("Could not find a translation for '%s' for language %s, falling back to English.", name, language);
                return getLocalizedString(name, substitutions, "en");
            }
            else {
                console.warn("Could not find a message for '%s.'", name);
                return name;
            }
        }
        else if (IS_CHROME) {
            var message = chrome.i18n.getMessage(name, substitutions);
            if (message == null || message.length == 0 || message == name) {
                console.warn("Could not find an translation for '" + name + "'.");
                message = name;
            }
            return message;
        }
        return name;
    }
    extension.getLocalizedString = getLocalizedString;
    function _getBrowserLanguage() {
        var language = navigator.language.toLowerCase();
        var parts = language.split('-');
        if (parts.length === 2)
            language = parts[0].toLowerCase() + '_' + parts[1].toUpperCase();
        return language;
    }
    function prepareLocalizedMessage(localization, substitutions) {
        var message = localization.message;
        if (localization.placeholders) {
            var placeholders = localization.placeholders;
            for (var placeholder in localization.placeholders) {
                if (localization.placeholders.hasOwnProperty(placeholder) && typeof placeholders[placeholder].content === "string") {
                    var parameterIndex = parseInt(placeholders[placeholder].content.replace("$", "")) - 1;
                    if (!isNaN(parameterIndex)) {
                        var substitution = substitutions[parameterIndex] ? substitutions[parameterIndex] : "";
                        message = message.replace("$" + placeholder + "$", substitution);
                    }
                }
            }
        }
        return message;
    }
    /**
    * Returns the object with localizations for the specified language and
    * caches the localization file to limit file read actions. Returns null
    * if the localization is not available.
    **/
    function _getLocale(language) {
        if (typeof _locales[language] === 'object')
            return _locales[language];
        else {
            try {
                var url = safari.extension.baseURI + "_locales/" + language + "/messages.json";
                var r = new XMLHttpRequest();
                r.open("GET", url, false);
                r.send(null);
                var data = JSON.parse(r.responseText);
                _locales[language] = data;
            }
            catch (e) {
                _locales[language] = null;
            }
            return _locales[language];
        }
    }
    function getResourceURL(file) {
        if (IS_SAFARI)
            return safari.extension.baseURI + file;
        if (IS_CHROME)
            return chrome.runtime.getURL(file);
    }
    extension.getResourceURL = getResourceURL;
    function createTab(url) {
        // Safari
        if (IS_SAFARI) {
            if (!url.match(/^http/)) {
                url = safari.extension.baseURI + url;
            }
            var browserWindow = safari.application.activeBrowserWindow;
            if (browserWindow == null) {
                browserWindow = safari.application.openBrowserWindow();
            }
            var tab = browserWindow.activeTab;
            if (tab == null || tab.url != null) {
                tab = browserWindow.openTab();
            }
            tab.url = url;
            browserWindow.activate();
            tab.activate();
        }
        else if (IS_CHROME) {
            chrome.tabs.create({ "url": url });
        }
    }
    extension.createTab = createTab;
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
            chrome.browserAction.setBadgeBackgroundColor({ color: [0, 200, 0, 100] });
            chrome.browserAction.setBadgeText({ text: text });
        }
    }
    extension.setBadge = setBadge;
    function getPopovers() {
        var popovers = new Array();
        if (IS_SAFARI) {
            $.each(safari.extension.popovers, function (index, popover) {
                popovers.push(popover.contentWindow);
            });
        }
        else if (IS_CHROME) {
            popovers = chrome.extension.getViews({ type: 'popup' });
        }
        return popovers;
    }
    extension.getPopovers = getPopovers;
    function hidePopovers() {
        if (IS_SAFARI) {
            var popovers = getSafariPopoverObjects();
            for (var i = 0; i < popovers.length; i++) {
                popovers[i].hide();
            }
        }
        else if (IS_CHROME) {
            var popoverWindows = getPopovers();
            for (var i = 0; i < popoverWindows.length; i++) {
                popoverWindows[i].close();
            }
        }
    }
    extension.hidePopovers = hidePopovers;
    function getSafariPopoverObjects() {
        var popovers = new Array();
        if (IS_SAFARI) {
            $.each(safari.extension.popovers, function (index, popover) {
                popovers.push(popover);
            });
        }
        return popovers;
    }
    extension.getSafariPopoverObjects = getSafariPopoverObjects;
    function getSafariPopoverObject(identifier) {
        var popovers = getSafariPopoverObjects();
        for (var i = 0; i < popovers.length; i++) {
            if (popovers[i].identifier == identifier)
                return popovers[i];
        }
        return null;
    }
    extension.getSafariPopoverObject = getSafariPopoverObject;
    function onPopoverVisible(eventHandler, identifier) {
        if (IS_SAFARI) {
            safari.application.addEventListener("popover", function (event /*SafariValidateEvent<SafariExtensionPopover>*/) {
                if (event.target.identifier == identifier) {
                    eventHandler(event);
                }
            }, true);
        }
        else if (IS_CHROME) {
            $(document).ready(eventHandler);
        }
    }
    extension.onPopoverVisible = onPopoverVisible;
    function onPopoverHidden(eventHandler, identifier) {
        if (IS_SAFARI) {
            safari.application.addEventListener("popover", function (event /*SafariValidateEvent<SafariExtensionPopover>*/) {
                if (event.target.identifier == identifier) {
                    var safariPopover = getSafariPopoverObject(identifier);
                    if (safariPopover != null) {
                        var popoverVisibilityTimer = setInterval(function () {
                            if (safariPopover.visible === false) {
                                eventHandler();
                                clearInterval(popoverVisibilityTimer);
                            }
                        }, 1000);
                    }
                }
            });
        }
        else if (IS_CHROME) {
            $(window).unload(eventHandler);
        }
    }
    extension.onPopoverHidden = onPopoverHidden;
    function getBackgroundPage() {
        var backgroundPage;
        if (IS_SAFARI) {
            backgroundPage = safari.extension.globalPage.contentWindow;
        }
        else if (IS_CHROME) {
            backgroundPage = chrome.extension.getBackgroundPage();
        }
        return backgroundPage;
    }
    extension.getBackgroundPage = getBackgroundPage;
    // !Context menus
    var contextMenuItems = {};
    if (IS_SAFARI && typeof safari.application === "object") {
        safari.application.addEventListener("contextmenu", function (event) {
            for (var id in contextMenuItems) {
                if (contextMenuItems.hasOwnProperty(id)) {
                    event.contextMenu.appendContextMenuItem(id, contextMenuItems[id].title);
                }
            }
        }, false);
        safari.application.addEventListener("validate", function (event /*SafariExtensionContextMenuItemValidateEvent*/) {
            if (contextMenuItems.hasOwnProperty(event.command)) {
                event.target.disabled = false; //!contextMenuItems[event.command].enabled;
            }
        }, false);
        safari.application.addEventListener("command", function (event) {
            if (contextMenuItems.hasOwnProperty(event.command) && typeof contextMenuItems[event.command].onclick === "function") {
                contextMenuItems[event.command].onclick(event.userInfo, null);
            }
        }, false);
    }
    function createContextMenuItem(options) {
        if (contextMenuItems.hasOwnProperty(options.id)) {
            var id = options.id;
            delete options.id;
            updateContextMenuItem(id, options);
        }
        else {
            contextMenuItems[options.id] = options;
            if (IS_CHROME) {
                chrome.contextMenus.create(options);
            }
        }
    }
    extension.createContextMenuItem = createContextMenuItem;
    function updateContextMenuItem(id, newOptions) {
        if (contextMenuItems.hasOwnProperty(id)) {
            for (var key in newOptions) {
                contextMenuItems[id][key] = newOptions[key];
            }
            if (IS_CHROME) {
                chrome.contextMenus.update(id, newOptions);
            }
        }
    }
    extension.updateContextMenuItem = updateContextMenuItem;
    function removeContextMenuItem(id) {
        if (contextMenuItems.hasOwnProperty(id)) {
            delete contextMenuItems[id];
            if (IS_CHROME) {
                chrome.contextMenus.remove(id);
            }
        }
    }
    extension.removeContextMenuItem = removeContextMenuItem;
    // !Safari extension update check
    function safariCheckForUpdate() {
        if (IS_SAFARI) {
            var currentVersion = extension.getExtensionBundleVersion();
            $.ajax({
                type: 'GET',
                url: SAFARI_UPDATE_MANIFEST,
                dataType: 'xml'
            }).done(function (data) {
                // Find dictionary for this extension
                $.each($(data).find("key"), function (index, key) {
                    if ($(key).text() == 'CFBundleIdentifier' && $(key).next().text() == 'nl.luukdobber.safaridownloadstation') {
                        var dict = $(key).closest('dict');
                        var updateUrl;
                        // Find the latest version
                        $.each(dict.find("key"), function (index, key) {
                            if ($(key).text() == 'URL') {
                                updateUrl = $(key).next().text();
                            }
                        });
                        $.each(dict.find("key"), function (index, key) {
                            if ($(key).text() == 'CFBundleVersion') {
                                var latestVersion = parseInt($(key).next().text());
                                if (currentVersion < latestVersion) {
                                    showNotification("Synology Download Station", getLocalizedString("newVersionAvailable"), true, updateUrl);
                                }
                            }
                        });
                    }
                });
            });
        }
    }
    extension.safariCheckForUpdate = safariCheckForUpdate;
    ;
    var notificationOnClickUrls = {};
    // !Notifications
    function showNotification(title, text, keepVisible, onclickUrl) {
        var keepVisible = keepVisible || false;
        var textDirection = (extension.getLocalizedString("textDirection") == "rtl" ? "rtl" : "ltr");
        var icon = "Icon-48.png";
        if (window.chrome && chrome.notifications && chrome.notifications.create) {
            var options = {
                type: "basic",
                title: title,
                message: text,
                iconUrl: extension.getResourceURL("Icon-64.png"),
            };
            if (onclickUrl) {
                options.isClickable = true;
            }
            options.requireInteraction = keepVisible;
            chrome.notifications.create(options, function (notificationId) {
                if (onclickUrl) {
                    notificationOnClickUrls[notificationId] = onclickUrl;
                }
            });
        }
        else if ("Notification" in window) {
            var notification = new window["Notification"](title, {
                dir: textDirection,
                body: text,
                icon: icon,
            });
            if (onclickUrl) {
                notification.onclick = function () {
                    extension.createTab(onclickUrl);
                    this.close();
                };
            }
            if (keepVisible == false) {
                setTimeout(function () {
                    notification.close();
                }, 5000);
            }
            return notification;
        }
        return null;
    }
    extension.showNotification = showNotification;
    if (window.chrome && chrome.notifications && chrome.notifications.onClicked) {
        chrome.notifications.onClicked.addListener(function (notificationId) {
            if (notificationOnClickUrls[notificationId]) {
                extension.createTab(notificationOnClickUrls[notificationId]);
                chrome.notifications.clear(notificationId);
                delete notificationOnClickUrls[notificationId];
            }
        });
    }
    /*
        // !Message passing
        extension.sendMessageFromContent = function(name, message) {
            var messageData = {
                id: Math.random().toString(36).substring(7),
                name: name,
                message: message
            };
            if(IS_CHROME) {
                if(chrome.runtime && chrome.runtime.sendMessage){
                    chrome.runtime.sendMessage(messageData);
                }
                else if(chrome.extension && chrome.extension.sendRequest)
                {
                    chrome.extension.sendRequest(messageData);
                }
            }
            if(IS_SAFARI) {
                if(typeof safari.self.tab == "object" && safari.self.tab instanceof SafariContentBrowserTabProxy)
                    safari.self.tab.dispatchMessage("extensionMessage", messageData, false);
                else if(safari.application.activeBrowserWindow && safari.application.activeBrowserWindow.activeTab.page instanceof SafariWebPageProxy)
                    safari.application.activeBrowserWindow.activeTab.page.dispatchMessage("extensionMessage", messageData, false);
            }
        };
    */
    var safariMessageResponseHandlers = {};
    function sendMessageToBackground(name, message, responseCallback) {
        var messageData = {
            id: Math.random().toString(36).substring(7),
            name: name,
            message: message,
            acceptsCallback: responseCallback != null
        };
        if (responseCallback) {
            safariMessageResponseHandlers[messageData.id] = responseCallback;
        }
        if (IS_CHROME) {
            chrome.runtime.sendMessage(messageData);
        }
        else if (IS_SAFARI) {
            if (typeof safari.self.tab == "object" && safari.self.tab instanceof window["SafariContentBrowserTabProxy"]) {
                safari.self.tab.dispatchMessage("extensionMessage", messageData, false);
            }
            else if (safari.application.activeBrowserWindow && safari.application.activeBrowserWindow.activeTab.page instanceof window["SafariWebPageProxy"]) {
                safari.application.activeBrowserWindow.activeTab.page.dispatchMessage("extensionMessage", messageData);
            }
        }
    }
    extension.sendMessageToBackground = sendMessageToBackground;
    ;
    function sendMessageToContent(name, message, responseCallback) {
        var messageData = {
            id: Math.random().toString(36).substring(7),
            name: name,
            message: message,
            acceptsCallback: responseCallback != null
        };
        if (responseCallback) {
            safariMessageResponseHandlers[messageData.id] = responseCallback;
        }
        if (IS_CHROME) {
            if (chrome.tabs) {
                chrome.tabs.query({ active: true }, function (tabs) {
                    if (tabs.length > 0) {
                        chrome.tabs.sendMessage(tabs[0].id, messageData);
                    }
                });
            }
        }
        if (IS_SAFARI) {
            if (typeof safari.self.tab == "object" && safari.self.tab instanceof window["SafariContentBrowserTabProxy"])
                safari.self.tab.dispatchMessage("extensionMessage", messageData, false);
            else if (safari.application.activeBrowserWindow != null && safari.application.activeBrowserWindow.activeTab.page instanceof window["SafariWebPageProxy"])
                safari.application.activeBrowserWindow.activeTab.page.dispatchMessage("extensionMessage", messageData);
        }
    }
    extension.sendMessageToContent = sendMessageToContent;
    var receivedMessages = [];
    function onMessage(callback) {
        var messageHandler = function (messageData, sendResponse) {
            if (!messageData || !messageData.id)
                return;
            if (receivedMessages.indexOf(messageData.id) != -1)
                return;
            callback({ name: messageData.name, message: messageData.message }, sendResponse);
        };
        if (IS_CHROME) {
            if (chrome.runtime && chrome.runtime.onMessage) {
                chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
                    if (request.id) {
                        messageHandler(request, function (responseMessage) {
                            var messageData = {
                                responseTo: request.id,
                                message: responseMessage
                            };
                            if (sender.tab && sender.frameId) {
                                chrome.tabs.sendMessage(sender.tab.id, messageData, { frameId: sender.frameId });
                            }
                            else if (sender.tab) {
                                chrome.tabs.sendMessage(sender.tab.id, messageData);
                            }
                            else {
                                chrome.runtime.sendMessage(messageData);
                            }
                        });
                    }
                });
            }
        }
        if (IS_SAFARI) {
            var eventHandler = function (event) {
                if (event.name === "extensionMessage") {
                    messageHandler(event.message, function (responseMessage) {
                        var messageData = {
                            responseTo: event.message.id,
                            message: responseMessage
                        };
                        if (typeof safari.self.tab == "object" && safari.self.tab instanceof window["SafariContentBrowserTabProxy"])
                            safari.self.tab.dispatchMessage("extensionMessageResponse", messageData, false);
                        else if (safari.application.activeBrowserWindow != null && safari.application.activeBrowserWindow.activeTab.page instanceof window["SafariWebPageProxy"])
                            safari.application.activeBrowserWindow.activeTab.page.dispatchMessage("extensionMessageResponse", messageData);
                    });
                }
            };
            if (typeof safari.application === "object")
                safari.application.addEventListener("message", eventHandler, false);
            else if (typeof safari.self === "object") {
                safari.self.addEventListener("message", eventHandler, false);
            }
            else {
                console.warn("Could not find safari.application or safari.self to add message event listener.");
            }
        }
    }
    extension.onMessage = onMessage;
    ;
    // Handle message responses
    if (IS_CHROME) {
        chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
            if (request.responseTo) {
                var responseHandler = safariMessageResponseHandlers[request.responseTo];
                if (responseHandler) {
                    responseHandler(request.message);
                    delete safariMessageResponseHandlers[request.responseTo];
                }
            }
        });
    }
    else if (IS_SAFARI) {
        var eventHandler = function (event) {
            if (event.name === "extensionMessageResponse") {
                var responseHandler = safariMessageResponseHandlers[event.message.responseTo];
                if (responseHandler) {
                    responseHandler(event.message.message);
                    delete safariMessageResponseHandlers[event.message.responseTo];
                }
            }
        };
        if (typeof safari.application === "object")
            safari.application.addEventListener("message", eventHandler, false);
        else if (typeof safari.self === "object") {
            safari.self.addEventListener("message", eventHandler, false);
        }
        else {
            console.warn("Could not find safari.application or safari.self to add message event listener.");
        }
    }
})(extension || (extension = {}));
/* !Storage */
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
        ;
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
                        console.log("Error while retreving storage item with key %s", keys[i]);
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
        ;
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
        ;
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
        ;
        function addEventListener(eventHandler) {
            if (IS_SAFARI) {
                if (!safari.extension.secureSettings)
                    return;
                var cachedChanges = {};
                safari.extension.secureSettings.addEventListener("change", function (event) {
                    if (event.oldValue != event.newValue) {
                        // Wait for other changes so they can be bundled in 1 event
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
        ;
    })(storage = extension.storage || (extension.storage = {}));
})(extension || (extension = {}));

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImpzL2Jyb3dzZXItZnVuY3Rpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGdEQUFnRDtBQUNoRCxJQUFJLFNBQVMsR0FBRyxDQUFDLE9BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxXQUFXLENBQUMsQ0FBQztBQUNoRCxJQUFJLFNBQVMsR0FBRyxDQUFDLE9BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxXQUFXLENBQUMsQ0FBQztBQUNoRCxJQUFJLFFBQVEsR0FBSSxTQUFTLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUN4RCxJQUFJLHNCQUFzQixHQUFXLHNCQUFzQixDQUFDO0FBRTVELEVBQUUsQ0FBQSxDQUFDLFNBQVMsSUFBSSxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO0lBQ3pELE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFTLE1BQU0sQ0FBQyxJQUFLLENBQUMsV0FBVyxDQUFDO0FBQzFELENBQUM7QUFFRCxJQUFVLFNBQVMsQ0FzcEJsQjtBQXRwQkQsV0FBVSxTQUFTLEVBQUMsQ0FBQztJQWlCcEIsSUFBSSxRQUFRLEdBQW9DLEVBQUUsQ0FBQztJQUNuRCxJQUFJLFFBQVEsR0FBVyxJQUFJLENBQUM7SUFFNUI7UUFDQyxFQUFFLENBQUEsQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDO1lBQ25CLE1BQU0sQ0FBQyxRQUFRLENBQUM7UUFFakIsU0FBUztRQUNULEVBQUUsQ0FBQSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7WUFDZCxJQUFJLENBQUMsR0FBRyxJQUFJLGNBQWMsRUFBRSxDQUFDO1lBQzdCLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLFlBQVksRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNuQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2IsSUFBSSxJQUFJ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QUFDLENBQUM7d0JBQ1YsQ0FBQzt3QkFFRCxhQUFhLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsUUFBUSxFQUFFLEtBQUssQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQztvQkFDbkYsQ0FBQztnQkFDRixDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDWCxDQUFDO1lBRUQsRUFBRSxDQUFBLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztnQkFDZCxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsVUFBQyxPQUFPLEVBQUUsUUFBUTtvQkFDdEQsRUFBRSxDQUFBLENBQUMsUUFBUSxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUM7d0JBQ3hCLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztvQkFDdkIsQ0FBQztnQkFDRixDQUFDLENBQUMsQ0FBQztZQUNKLENBQUM7UUFDRixDQUFDO1FBN0JlLHdCQUFnQixtQkE2Qi9CLENBQUE7UUFBQSxDQUFDO0lBQ0gsQ0FBQyxFQTNIbUIsT0FBTyxHQUFQLGlCQUFPLEtBQVAsaUJBQU8sUUEySDFCO0FBQUQsQ0FBQyxFQTNIUyxTQUFTLEtBQVQsU0FBUyxRQTJIbEIiLCJmaWxlIjoianMvYnJvd3Nlci1mdW5jdGlvbnMuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vdHlwaW5ncy9pbmRleC5kLnRzXCIvPlxudmFyIElTX1NBRkFSSSA9ICh0eXBlb2Yoc2FmYXJpKSAhPSBcInVuZGVmaW5lZFwiKTtcbnZhciBJU19DSFJPTUUgPSAodHlwZW9mKGNocm9tZSkgIT0gXCJ1bmRlZmluZWRcIik7XG52YXIgSVNfT1BFUkEgID0gbmF2aWdhdG9yLnZlbmRvci5pbmRleE9mKFwiT3BlcmFcIikgIT0gLTE7XG52YXIgU0FGQVJJX1VQREFURV9NQU5JRkVTVDogc3RyaW5nID0gU0FGQVJJX1VQREFURV9NQU5JRkVTVDtcblxuaWYoSVNfQ0hST01FICYmIGNocm9tZS50YWJzICYmICFjaHJvbWUudGFicy5zZW5kTWVzc2FnZSkge1xuXHRjaHJvbWUudGFicy5zZW5kTWVzc2FnZSA9ICg8YW55PmNocm9tZS50YWJzKS5zZW5kUmVxdWVzdDtcbn1cblxubmFtZXNwYWNlIGV4dGVuc2lvbiB7XG5cbiAgICBpbnRlcmZhY2UgTG9jYWxpemF0aW9uIHtcbiAgICAgICAgW2tleTogc3RyaW5nXTogTG9jYWxpemF0aW9uTWVzc2FnZVxuICAgIH1cblxuICAgIGludGVyZmFjZSBMb2NhbGl6YXRpb25NZXNzYWdlIHtcbiAgICAgICAgbWVzc2FnZTogc3RyaW5nO1xuICAgICAgICBkZXNjcmlwdGlvbj86IHN0cmluZztcbiAgICAgICAgcGxhY2Vob2xkZXJzPzogeyBba2V5OiBzdHJpbmddOiBMb2NhbGl6YXRpb25QbGFjZWhvbGRlciB9XG4gICAgfVxuXG4gICAgaW50ZXJmYWNlIExvY2FsaXphdGlvblBsYWNlaG9sZGVyIHtcbiAgICAgICAgY29udGVudDogc3RyaW5nO1xuICAgICAgICBleGFtcGxlPzogc3RyaW5nO1xuICAgIH1cblxuXHR2YXIgX2xvY2FsZXM6IHsgW2tleTogc3RyaW5nXTogTG9jYWxpemF0aW9uIH0gPSB7fTtcblx0dmFyIF92ZXJzaW9uOiBzdHJpbmcgPSBudWxsO1xuXHRcblx0ZXhwb3J0IGZ1bmN0aW9uIGdldEV4dGVuc2lvblZlcnNpb24oKTogc3RyaW5nIHtcblx0XHRpZihfdmVyc2lvbiAhPSBudWxsKVxuXHRcdFx0cmV0dXJuIF92ZXJzaW9uO1xuXHRcdFxuXHRcdC8vIFNhZmFyaVxuXHRcdGlmKElTX1NBRkFSSSkge1xuXHRcdFx0dmFyIHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblx0XHRcdHIub3BlbihcIkdFVFwiLCBcIkluZm8ucGxpc3RcIiwgZmFsc2UpO1xuXHRcdFx0ci5zZW5kKG51bGwpO1xuXHRcdFx0dmFyIGRhdGEgPSByLnJlc3BvbnNlVGV4dDtcblx0XHRcdHZhciBjdXJyZW50VmVyc2lvbjogc3RyaW5nO1xuXHRcdFx0JC5lYWNoKCQoZGF0YSkuZmluZChcImtleVwiKSwgKGluZGV4OiBudW1iZXIsIGtleTogSlF1ZXJ5KSA9PiB7XG5cdFx0XHRcdGlmKCQoa2V5KS50ZXh0KCkgPT0gJ0NGQnVuZGxlU2hvcnRWZXJzaW9uU3RyaW5nJykge1xuXHRcdFx0XHRcdGN1cnJlbnRWZXJzaW9uID0gJChrZXkpLm5leHQoKS50ZXh0KCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0X3ZlcnNpb24gPSBjdXJyZW50VmVyc2lvbjtcblx0XHR9XG5cdFx0XG5cdFx0Ly8gQ2hyb21lXG5cdFx0ZWxzZSBpZihJU19DSFJPTUUpIHtcblx0XHRcdHZhciBtYW5pZmVzdCA9IGNocm9tZS5ydW50aW1lLmdldE1hbmlmZXN0KCk7XG5cdFx0XHRfdmVyc2lvbiA9IG1hbmlmZXN0LnZlcnNpb247XG5cdFx0fVxuXHRcdHJldHVybiBfdmVyc2lvbjtcblx0fVxuXHRcblx0ZXhwb3J0IGZ1bmN0aW9uIGdldEV4dGVuc2lvbkJ1bmRsZVZlcnNpb24oKTogbnVtYmVyIHtcblx0XHR2YXIgciA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXHRcdHIub3BlbihcIkdFVFwiLCBleHRlbnNpb24uZ2V0UmVzb3VyY2VVUkwoXCJJbmZvLnBsaXN0XCIpLCBmYWxzZSk7XG5cdFx0ci5zZW5kKG51bGwpO1xuXHRcdHZhciBkYXRhID0gci5yZXNwb25zZVRleHQ7XG5cdFx0dmFyIGN1cnJlbnRWZXJzaW9uOiBudW1iZXI7XG5cdFx0JC5lYWNoKCQoZGF0YSkuZmluZChcImtleVwiKSwgKGluZGV4LCBrZXkpID0+IHtcblx0XHRcdGlmKCQoa2V5KS50ZXh0KCkgPT0gJ0NGQnVuZGxlVmVyc2lvbicpIHtcblx0XHRcdFx0Y3VycmVudFZlcnNpb24gPSBwYXJzZUludCgkKGtleSkubmV4dCgpLnRleHQoKSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0cmV0dXJuIGN1cnJlbnRWZXJzaW9uO1xuXHR9XG5cdFxuXHRleHBvcnQgZnVuY3Rpb24gZ2V0TG9jYWxpemVkU3RyaW5nKG5hbWU6IHN0cmluZywgc3Vic3RpdHV0aW9ucz86IEFycmF5PHN0cmluZz4sIGxhbmd1YWdlPzogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRpZighQXJyYXkuaXNBcnJheShzdWJzdGl0dXRpb25zKSkge1xuXHRcdFx0c3Vic3RpdHV0aW9ucyA9IG5ldyBBcnJheSgpO1xuXHRcdH1cblx0XHRcblx0XHQvLyBTYWZhcmlcblx0XHRpZihJU19TQUZBUkkpIHtcblx0XHRcdGlmKCFsYW5ndWFnZSkge1xuXHRcdFx0XHRsYW5ndWFnZSA9IF9nZXRCcm93c2VyTGFuZ3VhZ2UoKTtcbiAgICAgICAgICAgIH1cblx0XHRcdFxuXHRcdFx0dmFyIGxvY2FsZSA9IF9nZXRMb2NhbGUobGFuZ3VhZ2UpO1xuXHRcdFx0XG5cdFx0XHRpZihsb2NhbGUgIT09IG51bGwgJiYgdHlwZW9mIGxvY2FsZVtuYW1lXSA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIGxvY2FsZVtuYW1lXS5tZXNzYWdlID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRyZXR1cm4gcHJlcGFyZUxvY2FsaXplZE1lc3NhZ2UobG9jYWxlW25hbWVdLCBzdWJzdGl0dXRpb25zKTtcbiAgICAgICAgICAgIH1cblx0XHRcdFxuXHRcdFx0ZWxzZSBpZihsYW5ndWFnZS5zcGxpdCgnXycpLmxlbmd0aCA9PSAyKSB7XG5cdFx0XHRcdHJldHVybiBnZXRMb2NhbGl6ZWRTdHJpbmcobmFtZSwgc3Vic3RpdHV0aW9ucywgbGFuZ3VhZ2Uuc3BsaXQoJ18nKVswXSk7XG4gICAgICAgICAgICB9XG5cdFx0XHRcblx0XHRcdGVsc2UgaWYobGFuZ3VhZ2UgIT0gXCJlblwiKSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybihcIkNvdWxkIG5vdCBmaW5kIGEgdHJhbnNsYXRpb24gZm9yICclcycgZm9yIGxhbmd1YWdlICVzLCBmYWxsaW5nIGJhY2sgdG8gRW5nbGlzaC5cIiwgbmFtZSwgbGFuZ3VhZ2UpO1xuXHRcdFx0XHRyZXR1cm4gZ2V0TG9jYWxpemVkU3RyaW5nKG5hbWUsIHN1YnN0aXR1dGlvbnMsIFwiZW5cIik7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKFwiQ291bGQgbm90IGZpbmQgYSBtZXNzYWdlIGZvciAnJXMuJ1wiLCBuYW1lKTtcblx0XHRcdFx0cmV0dXJuIG5hbWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdFxuXHRcdC8vIENocm9tZVxuXHRcdGVsc2UgaWYoSVNfQ0hST01FKSB7XG5cdFx0XHR2YXIgbWVzc2FnZSA9IGNocm9tZS5pMThuLmdldE1lc3NhZ2UobmFtZSwgc3Vic3RpdHV0aW9ucyk7XG5cdFx0XHRpZihtZXNzYWdlID09IG51bGwgfHwgbWVzc2FnZS5sZW5ndGggPT0gMCB8fCBtZXNzYWdlID09IG5hbWUpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKFwiQ291bGQgbm90IGZpbmQgYW4gdHJhbnNsYXRpb24gZm9yICdcIiArIG5hbWUgKyBcIicuXCIpO1xuXHRcdFx0XHRtZXNzYWdlID0gbmFtZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBtZXNzYWdlO1xuXHRcdH1cblx0ICAgIHJldHVybiBuYW1lO1xuXHR9XG5cdFxuXHRmdW5jdGlvbiBfZ2V0QnJvd3Nlckxhbmd1YWdlKCk6IHN0cmluZyB7XG5cdFx0dmFyIGxhbmd1YWdlID0gbmF2aWdhdG9yLmxhbmd1YWdlLnRvTG93ZXJDYXNlKCk7XG5cdFx0dmFyIHBhcnRzID0gbGFuZ3VhZ2Uuc3BsaXQoJy0nKTtcblx0XHRpZihwYXJ0cy5sZW5ndGggPT09IDIpXG5cdFx0XHRsYW5ndWFnZSA9IHBhcnRzWzBdLnRvTG93ZXJDYXNlKCkgKyAnXycgKyBwYXJ0c1sxXS50b1VwcGVyQ2FzZSgpO1xuXHRcdFxuXHRcdHJldHVybiBsYW5ndWFnZTtcblx0fVxuXG5cdGZ1bmN0aW9uIHByZXBhcmVMb2NhbGl6ZWRNZXNzYWdlKGxvY2FsaXphdGlvbjogTG9jYWxpemF0aW9uTWVzc2FnZSwgc3Vic3RpdHV0aW9ucz86IEFycmF5PHN0cmluZz4pOiBzdHJpbmcge1xuXHQgICAgdmFyIG1lc3NhZ2UgPSBsb2NhbGl6YXRpb24ubWVzc2FnZTtcblxuXHQgICAgaWYgKGxvY2FsaXphdGlvbi5wbGFjZWhvbGRlcnMpIHtcblx0ICAgICAgICB2YXIgcGxhY2Vob2xkZXJzID0gbG9jYWxpemF0aW9uLnBsYWNlaG9sZGVycztcblx0ICAgICAgICBmb3IgKHZhciBwbGFjZWhvbGRlciBpbiBsb2NhbGl6YXRpb24ucGxhY2Vob2xkZXJzKSB7XG5cdCAgICAgICAgICAgIGlmIChsb2NhbGl6YXRpb24ucGxhY2Vob2xkZXJzLmhhc093blByb3BlcnR5KHBsYWNlaG9sZGVyKSAmJiB0eXBlb2YgcGxhY2Vob2xkZXJzW3BsYWNlaG9sZGVyXS5jb250ZW50ID09PSBcInN0cmluZ1wiKSB7XG5cdCAgICAgICAgICAgICAgICB2YXIgcGFyYW1ldGVySW5kZXggPSBwYXJzZUludChwbGFjZWhvbGRlcnNbcGxhY2Vob2xkZXJdLmNvbnRlbnQucmVwbGFjZShcIiRcIiwgXCJcIikpIC0gMTtcblx0ICAgICAgICAgICAgICAgIGlmICghaXNOYU4ocGFyYW1ldGVySW5kZXgpKSB7XG5cdCAgICAgICAgICAgICAgICAgICAgdmFyIHN1YnN0aXR1dGlvbiA9IHN1YnN0aXR1dGlvbnNbcGFyYW1ldGVySW5kZXhdID8gc3Vic3RpdHV0aW9uc1twYXJhbWV0ZXJJbmRleF0gOiBcIlwiO1xuXHQgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2UgPSBtZXNzYWdlLnJlcGxhY2UoXCIkXCIgKyBwbGFjZWhvbGRlciArIFwiJFwiLCBzdWJzdGl0dXRpb24pO1xuXHQgICAgICAgICAgICAgICAgfVxuXHQgICAgICAgICAgICB9XG5cdCAgICAgICAgfVxuXHQgICAgfVxuXHQgICAgcmV0dXJuIG1lc3NhZ2U7XG5cdH1cblx0XG5cdC8qKlxuXHQqIFJldHVybnMgdGhlIG9iamVjdCB3aXRoIGxvY2FsaXphdGlvbnMgZm9yIHRoZSBzcGVjaWZpZWQgbGFuZ3VhZ2UgYW5kXG5cdCogY2FjaGVzIHRoZSBsb2NhbGl6YXRpb24gZmlsZSB0byBsaW1pdCBmaWxlIHJlYWQgYWN0aW9ucy4gUmV0dXJucyBudWxsXG5cdCogaWYgdGhlIGxvY2FsaXphdGlvbiBpcyBub3QgYXZhaWxhYmxlLlxuXHQqKi9cblx0ZnVuY3Rpb24gX2dldExvY2FsZShsYW5ndWFnZTogc3RyaW5nKTogTG9jYWxpemF0aW9uIHtcblx0XHRpZih0eXBlb2YgX2xvY2FsZXNbbGFuZ3VhZ2VdID09PSAnb2JqZWN0Jylcblx0XHRcdHJldHVybiBfbG9jYWxlc1tsYW5ndWFnZV07XG5cdFx0ZWxzZSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR2YXIgdXJsID0gc2FmYXJpLmV4dGVuc2lvbi5iYXNlVVJJICsgXCJfbG9jYWxlcy9cIiArIGxhbmd1YWdlICsgXCIvbWVzc2FnZXMuanNvblwiO1xuXHRcdFx0XHR2YXIgciA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXHRcdFx0XHRyLm9wZW4oXCJHRVRcIiwgdXJsLCBmYWxzZSk7XG5cdFx0XHRcdHIuc2VuZChudWxsKTtcblx0XHRcdFx0dmFyIGRhdGEgPSBKU09OLnBhcnNlKHIucmVzcG9uc2VUZXh0KTtcblx0XHRcdFx0X2xvY2FsZXNbbGFuZ3VhZ2VdID0gZGF0YTtcblx0XHRcdH0gY2F0Y2goZSl7XG5cdFx0XHRcdF9sb2NhbGVzW2xhbmd1YWdlXSA9IG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gX2xvY2FsZXNbbGFuZ3VhZ2VdO1xuXHRcdH1cblx0fVxuXHRcblx0XG5cdGV4cG9ydCBmdW5jdGlvbiBnZXRSZXNvdXJjZVVSTChmaWxlOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdGlmKElTX1NBRkFSSSlcblx0XHRcdHJldHVybiBzYWZhcmkuZXh0ZW5zaW9uLmJhc2VVUkkgKyBmaWxlO1xuXHRcdGlmKElTX0NIUk9NRSlcblx0XHRcdHJldHVybiBjaHJvbWUucnVudGltZS5nZXRVUkwoZmlsZSk7XG5cdH1cblx0XG5cdGV4cG9ydCBmdW5jdGlvbiBjcmVhdGVUYWIodXJsOiBzdHJpbmcpOiB2b2lkIHtcblx0XHQvLyBTYWZhcmlcblx0XHRpZihJU19TQUZBUkkpIHtcblx0XHRcdGlmICghdXJsLm1hdGNoKC9eaHR0cC8pKSB7XG5cdFx0XHRcdHVybCA9IHNhZmFyaS5leHRlbnNpb24uYmFzZVVSSSArIHVybDtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0dmFyIGJyb3dzZXJXaW5kb3cgPSBzYWZhcmkuYXBwbGljYXRpb24uYWN0aXZlQnJvd3NlcldpbmRvdztcblx0XHRcdGlmKGJyb3dzZXJXaW5kb3cgPT0gbnVsbCkge1xuXHRcdFx0XHRicm93c2VyV2luZG93ID0gc2FmYXJpLmFwcGxpY2F0aW9uLm9wZW5Ccm93c2VyV2luZG93KCk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHZhciB0YWIgPSBicm93c2VyV2luZG93LmFjdGl2ZVRhYjtcblx0XHRcdGlmKHRhYiA9PSBudWxsIHx8IHRhYi51cmwgIT0gbnVsbCkge1xuXHRcdFx0XHR0YWIgPSBicm93c2VyV2luZG93Lm9wZW5UYWIoKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0dGFiLnVybCA9IHVybDtcblx0XHRcdGJyb3dzZXJXaW5kb3cuYWN0aXZhdGUoKTtcblx0XHRcdHRhYi5hY3RpdmF0ZSgpO1xuXHRcdH1cblx0XHRcblx0XHQvLyBDaHJvbWVcblx0XHRlbHNlIGlmKElTX0NIUk9NRSkge1xuXHRcdFx0Y2hyb21lLnRhYnMuY3JlYXRlKHtcInVybFwiOnVybH0pO1xuXHRcdH1cblx0fVxuXHRcblx0ZXhwb3J0IGZ1bmN0aW9uIHNldEJhZGdlKHZhbHVlOiBudW1iZXIpIHtcblx0XHRpZihJU19TQUZBUkkpIHtcblx0XHRcdHZhciB0b29sYmFySXRlbXMgPSBzYWZhcmkuZXh0ZW5zaW9uLnRvb2xiYXJJdGVtcztcblx0XHRcdGZvcih2YXIgaSA9IDA7IGkgPCB0b29sYmFySXRlbXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYodG9vbGJhckl0ZW1zW2ldLmlkZW50aWZpZXIgPT0gXCJ0b29sYmFyQnV0dG9uXCIpXG5cdFx0XHRcdFx0dG9vbGJhckl0ZW1zW2ldLmJhZGdlID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGVsc2UgaWYoSVNfQ0hST01FKSB7XG4gICAgICAgICAgICB2YXIgdGV4dCA9IHZhbHVlID09PSAwID8gXCJcIiA6IHZhbHVlLnRvU3RyaW5nKCk7XG5cdFx0XHRjaHJvbWUuYnJvd3NlckFjdGlvbi5zZXRCYWRnZUJhY2tncm91bmRDb2xvcih7Y29sb3I6WzAsIDIwMCwgMCwgMTAwXX0pO1xuXHRcdFx0Y2hyb21lLmJyb3dzZXJBY3Rpb24uc2V0QmFkZ2VUZXh0KHt0ZXh0OnRleHR9KTtcblx0XHR9XG5cdH1cblx0XG5cdGV4cG9ydCBmdW5jdGlvbiBnZXRQb3BvdmVycygpOiBBcnJheTxXaW5kb3c+IHtcblx0XHR2YXIgcG9wb3ZlcnMgPSBuZXcgQXJyYXk8V2luZG93PigpO1xuXHRcdFxuXHRcdGlmKElTX1NBRkFSSSkge1xuXHRcdFx0JC5lYWNoKHNhZmFyaS5leHRlbnNpb24ucG9wb3ZlcnMsIGZ1bmN0aW9uKGluZGV4LCBwb3BvdmVyKSB7XG5cdFx0XHRcdHBvcG92ZXJzLnB1c2gocG9wb3Zlci5jb250ZW50V2luZG93KTtcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRlbHNlIGlmKElTX0NIUk9NRSkge1xuXHRcdFx0cG9wb3ZlcnMgPSBjaHJvbWUuZXh0ZW5zaW9uLmdldFZpZXdzKHt0eXBlOiAncG9wdXAnfSk7XG5cdFx0fVxuXHRcdFxuXHRcdHJldHVybiBwb3BvdmVycztcblx0fVxuXHRcblx0ZXhwb3J0IGZ1bmN0aW9uIGhpZGVQb3BvdmVycygpOiB2b2lkIHtcblx0XHRpZihJU19TQUZBUkkpIHtcblx0XHRcdHZhciBwb3BvdmVycyA9IGdldFNhZmFyaVBvcG92ZXJPYmplY3RzKCk7XG5cdFx0XHRmb3IodmFyIGkgPSAwOyBpIDwgcG9wb3ZlcnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0cG9wb3ZlcnNbaV0uaGlkZSgpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRlbHNlIGlmKElTX0NIUk9NRSkge1xuXHRcdFx0dmFyIHBvcG92ZXJXaW5kb3dzID0gZ2V0UG9wb3ZlcnMoKTtcblx0XHRcdGZvcih2YXIgaSA9IDA7IGkgPCBwb3BvdmVyV2luZG93cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRwb3BvdmVyV2luZG93c1tpXS5jbG9zZSgpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRcblx0ZXhwb3J0IGZ1bmN0aW9uIGdldFNhZmFyaVBvcG92ZXJPYmplY3RzKCk6IEFycmF5PFNhZmFyaUV4dGVuc2lvblBvcG92ZXI+IHtcblx0XHR2YXIgcG9wb3ZlcnMgPSBuZXcgQXJyYXk8U2FmYXJpRXh0ZW5zaW9uUG9wb3Zlcj4oKTtcblx0XHRcblx0XHRpZihJU19TQUZBUkkpIHtcblx0XHRcdCQuZWFjaChzYWZhcmkuZXh0ZW5zaW9uLnBvcG92ZXJzLCAoaW5kZXgsIHBvcG92ZXIpID0+IHtcblx0XHRcdFx0cG9wb3ZlcnMucHVzaChwb3BvdmVyKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRcblx0XHRyZXR1cm4gcG9wb3ZlcnM7XG5cdH1cblx0XG5cdGV4cG9ydCBmdW5jdGlvbiBnZXRTYWZhcmlQb3BvdmVyT2JqZWN0KGlkZW50aWZpZXI6IHN0cmluZyk6IFNhZmFyaUV4dGVuc2lvblBvcG92ZXIge1xuXHRcdHZhciBwb3BvdmVyczogQXJyYXk8U2FmYXJpRXh0ZW5zaW9uUG9wb3Zlcj4gPSBnZXRTYWZhcmlQb3BvdmVyT2JqZWN0cygpO1xuXHRcdGZvcih2YXIgaSA9IDA7IGkgPCBwb3BvdmVycy5sZW5ndGg7IGkrKykge1xuXHRcdFx0aWYocG9wb3ZlcnNbaV0uaWRlbnRpZmllciA9PSBpZGVudGlmaWVyKVxuXHRcdFx0XHRyZXR1cm4gcG9wb3ZlcnNbaV07XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cdFxuXHRleHBvcnQgZnVuY3Rpb24gb25Qb3BvdmVyVmlzaWJsZShldmVudEhhbmRsZXI6IChldmVudDogYW55KSA9PiB2b2lkLCBpZGVudGlmaWVyOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZihJU19TQUZBUkkpIHtcblx0XHRcdHNhZmFyaS5hcHBsaWNhdGlvbi5hZGRFdmVudExpc3RlbmVyKFwicG9wb3ZlclwiLCAoZXZlbnQ6IGFueS8qU2FmYXJpVmFsaWRhdGVFdmVudDxTYWZhcmlFeHRlbnNpb25Qb3BvdmVyPiovKSA9PiB7XG5cdFx0XHRcdGlmKGV2ZW50LnRhcmdldC5pZGVudGlmaWVyID09IGlkZW50aWZpZXIpIHtcblx0XHRcdFx0XHRldmVudEhhbmRsZXIoZXZlbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCB0cnVlKTtcblx0XHR9XG5cdFx0ZWxzZSBpZihJU19DSFJPTUUpIHtcblx0XHRcdCQoZG9jdW1lbnQpLnJlYWR5KGV2ZW50SGFuZGxlcik7XG5cdFx0fVxuXHR9XG5cdFxuXHRleHBvcnQgZnVuY3Rpb24gb25Qb3BvdmVySGlkZGVuKGV2ZW50SGFuZGxlcjogKCkgPT4gdm9pZCwgaWRlbnRpZmllcjogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYoSVNfU0FGQVJJKSB7XG5cdFx0XHRzYWZhcmkuYXBwbGljYXRpb24uYWRkRXZlbnRMaXN0ZW5lcihcInBvcG92ZXJcIiwgKGV2ZW50OiBhbnkvKlNhZmFyaVZhbGlkYXRlRXZlbnQ8U2FmYXJpRXh0ZW5zaW9uUG9wb3Zlcj4qLykgPT4ge1xuXHRcdFx0XHRpZihldmVudC50YXJnZXQuaWRlbnRpZmllciA9PSBpZGVudGlmaWVyKSB7XG5cdFx0XHRcdFx0dmFyIHNhZmFyaVBvcG92ZXIgPSBnZXRTYWZhcmlQb3BvdmVyT2JqZWN0KGlkZW50aWZpZXIpO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdGlmKHNhZmFyaVBvcG92ZXIgIT0gbnVsbCkge1xuXHRcdFx0XHRcdFx0dmFyIHBvcG92ZXJWaXNpYmlsaXR5VGltZXIgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGlmKHNhZmFyaVBvcG92ZXIudmlzaWJsZSA9PT0gZmFsc2UpIHtcblx0XHRcdFx0XHRcdFx0XHRldmVudEhhbmRsZXIoKTtcblx0XHRcdFx0XHRcdFx0XHRjbGVhckludGVydmFsKHBvcG92ZXJWaXNpYmlsaXR5VGltZXIpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9LCAxMDAwKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0XHRlbHNlIGlmKElTX0NIUk9NRSkge1xuXHRcdFx0JCh3aW5kb3cpLnVubG9hZChldmVudEhhbmRsZXIpO1xuXHRcdH1cblx0fVxuXHRcblx0ZXhwb3J0IGZ1bmN0aW9uIGdldEJhY2tncm91bmRQYWdlKCk6IFdpbmRvdyB7XG5cdFx0dmFyIGJhY2tncm91bmRQYWdlOiBXaW5kb3c7XG5cdFx0XG5cdFx0aWYoSVNfU0FGQVJJKSB7XG5cdFx0XHRiYWNrZ3JvdW5kUGFnZSA9IHNhZmFyaS5leHRlbnNpb24uZ2xvYmFsUGFnZS5jb250ZW50V2luZG93O1xuXHRcdH1cblx0XHRlbHNlIGlmKElTX0NIUk9NRSkge1xuXHRcdFx0YmFja2dyb3VuZFBhZ2UgPSBjaHJvbWUuZXh0ZW5zaW9uLmdldEJhY2tncm91bmRQYWdlKCk7XG5cdFx0fVxuXHRcdFxuXHRcdHJldHVybiBiYWNrZ3JvdW5kUGFnZTtcblx0fVxuXHRcblx0Ly8gIUNvbnRleHQgbWVudXNcblx0dmFyIGNvbnRleHRNZW51SXRlbXM6IHtba2V5OiBzdHJpbmddOiBjaHJvbWUuY29udGV4dE1lbnVzLkNyZWF0ZVByb3BlcnRpZXN9ID0ge307XG5cdGlmKElTX1NBRkFSSSAmJiB0eXBlb2Ygc2FmYXJpLmFwcGxpY2F0aW9uID09PSBcIm9iamVjdFwiKSB7XG5cdFx0c2FmYXJpLmFwcGxpY2F0aW9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjb250ZXh0bWVudVwiLCAoZXZlbnQ6IFNhZmFyaUV4dGVuc2lvbkNvbnRleHRNZW51RXZlbnQpID0+IHtcblx0XHRcdGZvcih2YXIgaWQgaW4gY29udGV4dE1lbnVJdGVtcylcblx0XHRcdHtcblx0XHRcdFx0aWYoY29udGV4dE1lbnVJdGVtcy5oYXNPd25Qcm9wZXJ0eShpZCkpIHtcblx0XHRcdFx0XHRldmVudC5jb250ZXh0TWVudS5hcHBlbmRDb250ZXh0TWVudUl0ZW0oaWQsIGNvbnRleHRNZW51SXRlbXNbaWRdLnRpdGxlKTtcdFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSwgZmFsc2UpO1xuXHRcdFxuXHRcdHNhZmFyaS5hcHBsaWNhdGlvbi5hZGRFdmVudExpc3RlbmVyKFwidmFsaWRhdGVcIiwgKGV2ZW50OiBhbnkvKlNhZmFyaUV4dGVuc2lvbkNvbnRleHRNZW51SXRlbVZhbGlkYXRlRXZlbnQqLykgPT4ge1xuXHRcdFx0aWYoY29udGV4dE1lbnVJdGVtcy5oYXNPd25Qcm9wZXJ0eShldmVudC5jb21tYW5kKSkge1xuXHRcdFx0XHRldmVudC50YXJnZXQuZGlzYWJsZWQgPSBmYWxzZTsgLy8hY29udGV4dE1lbnVJdGVtc1tldmVudC5jb21tYW5kXS5lbmFibGVkO1xuXHRcdFx0fVxuXHRcdH0sIGZhbHNlKTtcblx0XHRcblx0XHRzYWZhcmkuYXBwbGljYXRpb24uYWRkRXZlbnRMaXN0ZW5lcihcImNvbW1hbmRcIiwgZnVuY3Rpb24oZXZlbnQ6IFNhZmFyaUV4dGVuc2lvbkNvbnRleHRNZW51SXRlbUNvbW1hbmRFdmVudCkge1xuXHRcdFx0aWYoY29udGV4dE1lbnVJdGVtcy5oYXNPd25Qcm9wZXJ0eShldmVudC5jb21tYW5kKSAmJiB0eXBlb2YgY29udGV4dE1lbnVJdGVtc1tldmVudC5jb21tYW5kXS5vbmNsaWNrID09PSBcImZ1bmN0aW9uXCIpIHtcblx0XHRcdFx0Y29udGV4dE1lbnVJdGVtc1tldmVudC5jb21tYW5kXS5vbmNsaWNrKDxjaHJvbWUuY29udGV4dE1lbnVzLk9uQ2xpY2tEYXRhPiBldmVudC51c2VySW5mbywgbnVsbCk7XG5cdFx0XHR9XG5cdFx0fSwgZmFsc2UpO1xuXHR9XG5cdFxuXHRleHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29udGV4dE1lbnVJdGVtKG9wdGlvbnM6IGNocm9tZS5jb250ZXh0TWVudXMuQ3JlYXRlUHJvcGVydGllcyk6IHZvaWQge1xuXHRcdGlmKGNvbnRleHRNZW51SXRlbXMuaGFzT3duUHJvcGVydHkob3B0aW9ucy5pZCkpIHtcblx0XHRcdHZhciBpZCA9IG9wdGlvbnMuaWQ7XG5cdFx0XHRkZWxldGUgb3B0aW9ucy5pZDtcblx0XHRcdHVwZGF0ZUNvbnRleHRNZW51SXRlbShpZCwgb3B0aW9ucyk7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0Y29udGV4dE1lbnVJdGVtc1tvcHRpb25zLmlkXSA9IG9wdGlvbnM7XG5cdFx0XHRcblx0XHRcdGlmIChJU19DSFJPTUUpIHtcblx0XHRcdFx0Y2hyb21lLmNvbnRleHRNZW51cy5jcmVhdGUob3B0aW9ucyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdFxuXHRleHBvcnQgZnVuY3Rpb24gdXBkYXRlQ29udGV4dE1lbnVJdGVtKGlkOiBzdHJpbmcsIG5ld09wdGlvbnM6IGNocm9tZS5jb250ZXh0TWVudXMuVXBkYXRlUHJvcGVydGllcyk6IHZvaWQge1xuXHRcdGlmKGNvbnRleHRNZW51SXRlbXMuaGFzT3duUHJvcGVydHkoaWQpKVxuXHRcdHtcblx0XHRcdGZvcih2YXIga2V5IGluIG5ld09wdGlvbnMpXG5cdFx0XHR7XG5cdFx0XHRcdCg8YW55PmNvbnRleHRNZW51SXRlbXNbaWRdKVtrZXldID0gKDxhbnk+bmV3T3B0aW9ucylba2V5XTtcblx0XHRcdH1cblx0XG5cdFx0XHRpZiAoSVNfQ0hST01FKSB7XG5cdFx0XHRcdGNocm9tZS5jb250ZXh0TWVudXMudXBkYXRlKGlkLCBuZXdPcHRpb25zKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0XG5cdGV4cG9ydCBmdW5jdGlvbiByZW1vdmVDb250ZXh0TWVudUl0ZW0oaWQ6IHN0cmluZykge1xuXHRcdGlmKGNvbnRleHRNZW51SXRlbXMuaGFzT3duUHJvcGVydHkoaWQpKVxuXHRcdHtcblx0XHRcdGRlbGV0ZSBjb250ZXh0TWVudUl0ZW1zW2lkXTtcblx0XHRcdFxuXHRcdFx0aWYgKElTX0NIUk9NRSkge1xuXHRcdFx0XHRjaHJvbWUuY29udGV4dE1lbnVzLnJlbW92ZShpZCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdFxuXHQvLyAhU2FmYXJpIGV4dGVuc2lvbiB1cGRhdGUgY2hlY2tcblx0ZXhwb3J0IGZ1bmN0aW9uIHNhZmFyaUNoZWNrRm9yVXBkYXRlKCkge1xuXHRcdGlmKElTX1NBRkFSSSkge1xuXHRcdFx0dmFyIGN1cnJlbnRWZXJzaW9uID0gZXh0ZW5zaW9uLmdldEV4dGVuc2lvbkJ1bmRsZVZlcnNpb24oKTtcblx0XHRcdFxuXHRcdFx0JC5hamF4KHtcblx0XHRcdFx0dHlwZTogJ0dFVCcsXG5cdFx0XHRcdHVybDogU0FGQVJJX1VQREFURV9NQU5JRkVTVCxcblx0XHRcdFx0ZGF0YVR5cGU6ICd4bWwnXG5cdFx0XHR9KS5kb25lKChkYXRhKSA9PiB7XG5cdFx0XHRcdC8vIEZpbmQgZGljdGlvbmFyeSBmb3IgdGhpcyBleHRlbnNpb25cblx0XHRcdFx0JC5lYWNoKCQoZGF0YSkuZmluZChcImtleVwiKSwgKGluZGV4OiBudW1iZXIsIGtleTogSlF1ZXJ5KSA9PiB7XG5cdFx0XHRcdFx0aWYoJChrZXkpLnRleHQoKSA9PSAnQ0ZCdW5kbGVJZGVudGlmaWVyJyAmJiAkKGtleSkubmV4dCgpLnRleHQoKSA9PSAnbmwubHV1a2RvYmJlci5zYWZhcmlkb3dubG9hZHN0YXRpb24nKSB7XG5cdFx0XHRcdFx0XHR2YXIgZGljdCA9ICQoa2V5KS5jbG9zZXN0KCdkaWN0Jyk7XG5cdFx0XHRcdFx0XHR2YXIgdXBkYXRlVXJsOiBzdHJpbmc7XG5cdFx0XHRcdFx0XHQvLyBGaW5kIHRoZSBsYXRlc3QgdmVyc2lvblxuXHRcdFx0XHRcdFx0JC5lYWNoKGRpY3QuZmluZChcImtleVwiKSwgKGluZGV4LCBrZXkpID0+IHtcblx0XHRcdFx0XHRcdFx0aWYoJChrZXkpLnRleHQoKSA9PSAnVVJMJykge1xuXHRcdFx0XHRcdFx0XHRcdHVwZGF0ZVVybCA9ICQoa2V5KS5uZXh0KCkudGV4dCgpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0JC5lYWNoKGRpY3QuZmluZChcImtleVwiKSwgKGluZGV4LCBrZXkpID0+IHtcblx0XHRcdFx0XHRcdFx0aWYoJChrZXkpLnRleHQoKSA9PSAnQ0ZCdW5kbGVWZXJzaW9uJykge1xuXHRcdFx0XHRcdFx0XHRcdHZhciBsYXRlc3RWZXJzaW9uID0gcGFyc2VJbnQoJChrZXkpLm5leHQoKS50ZXh0KCkpO1xuXHRcdFx0XHRcdFx0XHRcdGlmKGN1cnJlbnRWZXJzaW9uIDwgbGF0ZXN0VmVyc2lvbilcblx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRzaG93Tm90aWZpY2F0aW9uKFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcIlN5bm9sb2d5IERvd25sb2FkIFN0YXRpb25cIixcblx0XHRcdFx0XHRcdFx0XHRcdFx0Z2V0TG9jYWxpemVkU3RyaW5nKFwibmV3VmVyc2lvbkF2YWlsYWJsZVwiKSwgdHJ1ZSwgdXBkYXRlVXJsKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH07XG5cdFxuXHR2YXIgbm90aWZpY2F0aW9uT25DbGlja1VybHM6IHsgW2lkOiBzdHJpbmddIDogc3RyaW5nOyB9ID0ge307XG5cdC8vICFOb3RpZmljYXRpb25zXG5cdGV4cG9ydCBmdW5jdGlvbiBzaG93Tm90aWZpY2F0aW9uKHRpdGxlOiBzdHJpbmcsIHRleHQ6IHN0cmluZywga2VlcFZpc2libGU/OiBib29sZWFuLCBvbmNsaWNrVXJsPzogc3RyaW5nKSB7XG5cdFx0dmFyIGtlZXBWaXNpYmxlID0ga2VlcFZpc2libGUgfHwgZmFsc2U7XG5cdFx0dmFyIHRleHREaXJlY3Rpb24gPSAoZXh0ZW5zaW9uLmdldExvY2FsaXplZFN0cmluZyhcInRleHREaXJlY3Rpb25cIikgPT0gXCJydGxcIiA/IFwicnRsXCIgOiBcImx0clwiKTtcblx0XHR2YXIgaWNvbiA9IFwiSWNvbi00OC5wbmdcIjtcblx0XHRcblx0XHRpZih3aW5kb3cuY2hyb21lICYmIGNocm9tZS5ub3RpZmljYXRpb25zICYmIGNocm9tZS5ub3RpZmljYXRpb25zLmNyZWF0ZSkge1xuXHRcdFx0dmFyIG9wdGlvbnM6IGNocm9tZS5ub3RpZmljYXRpb25zLk5vdGlmaWNhdGlvbk9wdGlvbnMgPSB7XG5cdFx0XHRcdHR5cGU6IFwiYmFzaWNcIixcblx0XHRcdFx0dGl0bGU6IHRpdGxlLFxuXHRcdFx0XHRtZXNzYWdlOiB0ZXh0LFxuXHRcdFx0XHRpY29uVXJsOiBleHRlbnNpb24uZ2V0UmVzb3VyY2VVUkwoXCJJY29uLTY0LnBuZ1wiKSxcblx0XHRcdH07XG5cblx0XHRcdGlmKG9uY2xpY2tVcmwpIHtcblx0XHRcdFx0b3B0aW9ucy5pc0NsaWNrYWJsZSA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdCg8YW55Pm9wdGlvbnMpLnJlcXVpcmVJbnRlcmFjdGlvbiA9IGtlZXBWaXNpYmxlO1xuXHRcdFx0XG5cdFx0XHRjaHJvbWUubm90aWZpY2F0aW9ucy5jcmVhdGUob3B0aW9ucywgKG5vdGlmaWNhdGlvbklkOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0aWYob25jbGlja1VybCkge1xuXHRcdFx0XHRcdG5vdGlmaWNhdGlvbk9uQ2xpY2tVcmxzW25vdGlmaWNhdGlvbklkXSA9IG9uY2xpY2tVcmw7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0XHRlbHNlIGlmKFwiTm90aWZpY2F0aW9uXCIgaW4gd2luZG93KVxuXHRcdHtcblx0XHRcdHZhciBub3RpZmljYXRpb24gPSBuZXcgKDxhbnk+d2luZG93KVtcIk5vdGlmaWNhdGlvblwiXSh0aXRsZSwge1xuXHRcdFx0XHRkaXI6IHRleHREaXJlY3Rpb24sXG5cdFx0XHRcdGJvZHk6IHRleHQsXG5cdFx0XHRcdGljb246IGljb24sXG5cdFx0XHR9KTtcblx0XHRcdFxuXHRcdFx0aWYob25jbGlja1VybCkge1xuXHRcdFx0XHRub3RpZmljYXRpb24ub25jbGljayA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGV4dGVuc2lvbi5jcmVhdGVUYWIob25jbGlja1VybCk7XG5cdFx0XHRcdFx0dGhpcy5jbG9zZSgpO1xuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRpZihrZWVwVmlzaWJsZSA9PSBmYWxzZSkge1xuXHRcdFx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdG5vdGlmaWNhdGlvbi5jbG9zZSgpO1xuXHRcdFx0XHR9LCA1MDAwKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBub3RpZmljYXRpb247XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cdFxuXHRpZih3aW5kb3cuY2hyb21lICYmIGNocm9tZS5ub3RpZmljYXRpb25zICYmIGNocm9tZS5ub3RpZmljYXRpb25zLm9uQ2xpY2tlZCkge1xuXHRcdGNocm9tZS5ub3RpZmljYXRpb25zLm9uQ2xpY2tlZC5hZGRMaXN0ZW5lcigobm90aWZpY2F0aW9uSWQ6IHN0cmluZykgPT4ge1xuXHRcdFx0aWYobm90aWZpY2F0aW9uT25DbGlja1VybHNbbm90aWZpY2F0aW9uSWRdKSB7XG5cdFx0XHRcdGV4dGVuc2lvbi5jcmVhdGVUYWIobm90aWZpY2F0aW9uT25DbGlja1VybHNbbm90aWZpY2F0aW9uSWRdKTtcblx0XHRcdFx0Y2hyb21lLm5vdGlmaWNhdGlvbnMuY2xlYXIobm90aWZpY2F0aW9uSWQpO1xuXHRcdFx0XHRkZWxldGUgbm90aWZpY2F0aW9uT25DbGlja1VybHNbbm90aWZpY2F0aW9uSWRdO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cdFxuLypcblx0Ly8gIU1lc3NhZ2UgcGFzc2luZ1xuXHRleHRlbnNpb24uc2VuZE1lc3NhZ2VGcm9tQ29udGVudCA9IGZ1bmN0aW9uKG5hbWUsIG1lc3NhZ2UpIHtcblx0XHR2YXIgbWVzc2FnZURhdGEgPSB7XG5cdFx0XHRpZDogTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyaW5nKDcpLFxuXHRcdFx0bmFtZTogbmFtZSxcblx0XHRcdG1lc3NhZ2U6IG1lc3NhZ2Vcblx0XHR9O1xuXHRcdGlmKElTX0NIUk9NRSkge1xuXHRcdFx0aWYoY2hyb21lLnJ1bnRpbWUgJiYgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2Upe1xuXHRcdFx0XHRjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZShtZXNzYWdlRGF0YSk7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIGlmKGNocm9tZS5leHRlbnNpb24gJiYgY2hyb21lLmV4dGVuc2lvbi5zZW5kUmVxdWVzdClcblx0XHRcdHtcblx0XHRcdFx0Y2hyb21lLmV4dGVuc2lvbi5zZW5kUmVxdWVzdChtZXNzYWdlRGF0YSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmKElTX1NBRkFSSSkge1xuXHRcdFx0aWYodHlwZW9mIHNhZmFyaS5zZWxmLnRhYiA9PSBcIm9iamVjdFwiICYmIHNhZmFyaS5zZWxmLnRhYiBpbnN0YW5jZW9mIFNhZmFyaUNvbnRlbnRCcm93c2VyVGFiUHJveHkpXG5cdFx0XHRcdHNhZmFyaS5zZWxmLnRhYi5kaXNwYXRjaE1lc3NhZ2UoXCJleHRlbnNpb25NZXNzYWdlXCIsIG1lc3NhZ2VEYXRhLCBmYWxzZSk7XG5cdFx0XHRlbHNlIGlmKHNhZmFyaS5hcHBsaWNhdGlvbi5hY3RpdmVCcm93c2VyV2luZG93ICYmIHNhZmFyaS5hcHBsaWNhdGlvbi5hY3RpdmVCcm93c2VyV2luZG93LmFjdGl2ZVRhYi5wYWdlIGluc3RhbmNlb2YgU2FmYXJpV2ViUGFnZVByb3h5KVxuXHRcdFx0XHRzYWZhcmkuYXBwbGljYXRpb24uYWN0aXZlQnJvd3NlcldpbmRvdy5hY3RpdmVUYWIucGFnZS5kaXNwYXRjaE1lc3NhZ2UoXCJleHRlbnNpb25NZXNzYWdlXCIsIG1lc3NhZ2VEYXRhLCBmYWxzZSk7XG5cdFx0fVxuXHR9O1xuKi9cblx0XG5cdHZhciBzYWZhcmlNZXNzYWdlUmVzcG9uc2VIYW5kbGVyczoge1trZXk6IHN0cmluZ10gOiAobWVzc2FnZTogYW55KSA9PiB2b2lkfSA9IHt9O1xuXHRcblx0ZXhwb3J0IGZ1bmN0aW9uIHNlbmRNZXNzYWdlVG9CYWNrZ3JvdW5kKG5hbWU6IHN0cmluZywgbWVzc2FnZTogYW55LCByZXNwb25zZUNhbGxiYWNrPzogKG1lc3NhZ2U6IGFueSkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdHZhciBtZXNzYWdlRGF0YSA9IHtcblx0XHRcdGlkOiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHJpbmcoNyksXG5cdFx0XHRuYW1lOiBuYW1lLFxuXHRcdFx0bWVzc2FnZTogbWVzc2FnZSxcblx0XHRcdGFjY2VwdHNDYWxsYmFjazogcmVzcG9uc2VDYWxsYmFjayAhPSBudWxsXG5cdFx0fTtcblx0XHRcblx0XHRpZihyZXNwb25zZUNhbGxiYWNrKSB7XG5cdFx0XHRzYWZhcmlNZXNzYWdlUmVzcG9uc2VIYW5kbGVyc1ttZXNzYWdlRGF0YS5pZF0gPSByZXNwb25zZUNhbGxiYWNrO1xuICAgICAgICB9XG5cdFx0XG5cdFx0aWYoSVNfQ0hST01FKVxuXHRcdHtcblx0XHRcdGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKG1lc3NhZ2VEYXRhKTtcblx0XHR9XG5cdFx0ZWxzZSBpZihJU19TQUZBUkkpXG5cdFx0e1xuXHRcdFx0aWYodHlwZW9mICg8YW55PnNhZmFyaS5zZWxmKS50YWIgPT0gXCJvYmplY3RcIiAmJiAoPGFueT5zYWZhcmkuc2VsZikudGFiIGluc3RhbmNlb2YgKDxhbnk+d2luZG93KVtcIlNhZmFyaUNvbnRlbnRCcm93c2VyVGFiUHJveHlcIl0pIHtcblx0XHRcdFx0KDxhbnk+c2FmYXJpLnNlbGYpLnRhYi5kaXNwYXRjaE1lc3NhZ2UoXCJleHRlbnNpb25NZXNzYWdlXCIsIG1lc3NhZ2VEYXRhLCBmYWxzZSk7XG4gICAgICAgICAgICB9XG5cdFx0XHRlbHNlIGlmKHNhZmFyaS5hcHBsaWNhdGlvbi5hY3RpdmVCcm93c2VyV2luZG93ICYmIHNhZmFyaS5hcHBsaWNhdGlvbi5hY3RpdmVCcm93c2VyV2luZG93LmFjdGl2ZVRhYi5wYWdlIGluc3RhbmNlb2YgKDxhbnk+d2luZG93KVtcIlNhZmFyaVdlYlBhZ2VQcm94eVwiXSkge1xuXHRcdFx0XHRzYWZhcmkuYXBwbGljYXRpb24uYWN0aXZlQnJvd3NlcldpbmRvdy5hY3RpdmVUYWIucGFnZS5kaXNwYXRjaE1lc3NhZ2UoXCJleHRlbnNpb25NZXNzYWdlXCIsIG1lc3NhZ2VEYXRhKTtcbiAgICAgICAgICAgIH1cblx0XHR9XG5cdH07XG5cdFxuXHRleHBvcnQgZnVuY3Rpb24gc2VuZE1lc3NhZ2VUb0NvbnRlbnQobmFtZTogc3RyaW5nLCBtZXNzYWdlOiBhbnksIHJlc3BvbnNlQ2FsbGJhY2s/OiAobWVzc2FnZTogYW55KSA9PiB2b2lkKTogdm9pZCB7XG5cdFx0dmFyIG1lc3NhZ2VEYXRhID0ge1xuXHRcdFx0aWQ6IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cmluZyg3KSxcblx0XHRcdG5hbWU6IG5hbWUsXG5cdFx0XHRtZXNzYWdlOiBtZXNzYWdlLFxuXHRcdFx0YWNjZXB0c0NhbGxiYWNrOiByZXNwb25zZUNhbGxiYWNrICE9IG51bGxcblx0XHR9O1xuXHRcdFxuXHRcdGlmKHJlc3BvbnNlQ2FsbGJhY2spIHtcblx0XHRcdHNhZmFyaU1lc3NhZ2VSZXNwb25zZUhhbmRsZXJzW21lc3NhZ2VEYXRhLmlkXSA9IHJlc3BvbnNlQ2FsbGJhY2s7XG4gICAgICAgIH1cblx0XHRcblx0XHRpZihJU19DSFJPTUUpIHtcblx0XHRcdGlmKGNocm9tZS50YWJzKSB7XG5cdFx0XHRcdGNocm9tZS50YWJzLnF1ZXJ5KHthY3RpdmU6IHRydWV9LCAodGFicykgPT4ge1xuXHRcdFx0XHRcdGlmKHRhYnMubGVuZ3RoID4gMClcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRjaHJvbWUudGFicy5zZW5kTWVzc2FnZSh0YWJzWzBdLmlkLCBtZXNzYWdlRGF0YSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYoSVNfU0FGQVJJKSB7XG5cdFx0XHRpZih0eXBlb2YgKDxhbnk+c2FmYXJpLnNlbGYpLnRhYiA9PSBcIm9iamVjdFwiICYmICg8YW55PnNhZmFyaS5zZWxmKS50YWIgaW5zdGFuY2VvZiAoPGFueT53aW5kb3cpW1wiU2FmYXJpQ29udGVudEJyb3dzZXJUYWJQcm94eVwiXSlcblx0XHRcdFx0KDxhbnk+c2FmYXJpLnNlbGYpLnRhYi5kaXNwYXRjaE1lc3NhZ2UoXCJleHRlbnNpb25NZXNzYWdlXCIsIG1lc3NhZ2VEYXRhLCBmYWxzZSk7XG5cdFx0XHRlbHNlIGlmKHNhZmFyaS5hcHBsaWNhdGlvbi5hY3RpdmVCcm93c2VyV2luZG93ICE9IG51bGwgJiYgc2FmYXJpLmFwcGxpY2F0aW9uLmFjdGl2ZUJyb3dzZXJXaW5kb3cuYWN0aXZlVGFiLnBhZ2UgaW5zdGFuY2VvZiAoPGFueT53aW5kb3cpW1wiU2FmYXJpV2ViUGFnZVByb3h5XCJdKVxuXHRcdFx0XHRzYWZhcmkuYXBwbGljYXRpb24uYWN0aXZlQnJvd3NlcldpbmRvdy5hY3RpdmVUYWIucGFnZS5kaXNwYXRjaE1lc3NhZ2UoXCJleHRlbnNpb25NZXNzYWdlXCIsIG1lc3NhZ2VEYXRhKTtcblx0XHR9XG5cdH1cblxuICAgIGludGVyZmFjZSBNZXNzYWdlRXZlbnQge1xuICAgICAgICBuYW1lOiBzdHJpbmc7XG4gICAgICAgIG1lc3NhZ2U6IGFueTtcbiAgICB9XG5cdFxuXHR2YXIgcmVjZWl2ZWRNZXNzYWdlczogQXJyYXk8YW55PiA9IFtdO1xuXHRleHBvcnQgZnVuY3Rpb24gb25NZXNzYWdlKGNhbGxiYWNrOiAoZXZlbnQ6IE1lc3NhZ2VFdmVudCwgc2VuZFJlc3BvbnNlOiAobWVzc2FnZTogYW55KSA9PiB2b2lkKSA9PiB2b2lkKSB7XG5cdFx0XG5cdFx0dmFyIG1lc3NhZ2VIYW5kbGVyID0gKG1lc3NhZ2VEYXRhOiBhbnksIHNlbmRSZXNwb25zZTogKHJlc3BvbnNlTWVzc2FnZTogYW55KSA9PiB2b2lkKSA9PiB7XG5cdFx0XHRpZighbWVzc2FnZURhdGEgfHwgIW1lc3NhZ2VEYXRhLmlkKSByZXR1cm47XG5cdFx0XHRpZihyZWNlaXZlZE1lc3NhZ2VzLmluZGV4T2YobWVzc2FnZURhdGEuaWQpICE9IC0xKSByZXR1cm47XG5cdFx0XHRcblx0XHRcdGNhbGxiYWNrKHsgbmFtZTogbWVzc2FnZURhdGEubmFtZSwgbWVzc2FnZTogbWVzc2FnZURhdGEubWVzc2FnZSB9LCBzZW5kUmVzcG9uc2UpO1xuXHRcdH07XG5cdFx0XG5cdFx0aWYoSVNfQ0hST01FKSB7XG5cdFx0XHRpZihjaHJvbWUucnVudGltZSAmJiBjaHJvbWUucnVudGltZS5vbk1lc3NhZ2Upe1xuXHRcdFx0XHRjaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoKHJlcXVlc3QsIHNlbmRlciwgc2VuZFJlc3BvbnNlKSA9PiB7XG5cdFx0XHRcdFx0aWYocmVxdWVzdC5pZClcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRtZXNzYWdlSGFuZGxlcihyZXF1ZXN0LCAocmVzcG9uc2VNZXNzYWdlOiBhbnkpID0+IHtcblx0XHRcdFx0XHRcdFx0dmFyIG1lc3NhZ2VEYXRhID0ge1xuXHRcdFx0XHRcdFx0XHRcdHJlc3BvbnNlVG86IHJlcXVlc3QuaWQsXG5cdFx0XHRcdFx0XHRcdFx0bWVzc2FnZTogcmVzcG9uc2VNZXNzYWdlXG5cdFx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRcdGlmKHNlbmRlci50YWIgJiYgc2VuZGVyLmZyYW1lSWQpIHtcblx0XHRcdFx0XHRcdFx0XHRjaHJvbWUudGFicy5zZW5kTWVzc2FnZShzZW5kZXIudGFiLmlkLCBtZXNzYWdlRGF0YSwgeyBmcmFtZUlkOiBzZW5kZXIuZnJhbWVJZCB9KTtcblx0XHRcdFx0XHRcdFx0fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYoc2VuZGVyLnRhYikge1xuXHRcdFx0XHRcdFx0XHRcdGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKHNlbmRlci50YWIuaWQsIG1lc3NhZ2VEYXRhKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZShtZXNzYWdlRGF0YSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmKElTX1NBRkFSSSkge1xuXHRcdFx0dmFyIGV2ZW50SGFuZGxlciA9IChldmVudDogYW55KSA9PiB7XG5cdFx0XHRcdGlmKGV2ZW50Lm5hbWUgPT09IFwiZXh0ZW5zaW9uTWVzc2FnZVwiKVxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bWVzc2FnZUhhbmRsZXIoZXZlbnQubWVzc2FnZSwgKHJlc3BvbnNlTWVzc2FnZTogYW55KSA9PiB7XG5cdFx0XHRcdFx0XHR2YXIgbWVzc2FnZURhdGEgPSB7XG5cdFx0XHRcdFx0XHRcdHJlc3BvbnNlVG86IGV2ZW50Lm1lc3NhZ2UuaWQsXG5cdFx0XHRcdFx0XHRcdG1lc3NhZ2U6IHJlc3BvbnNlTWVzc2FnZVxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdFx0aWYodHlwZW9mICg8YW55PnNhZmFyaS5zZWxmKS50YWIgPT0gXCJvYmplY3RcIiAmJiAoPGFueT5zYWZhcmkuc2VsZikudGFiIGluc3RhbmNlb2YgKDxhbnk+d2luZG93KVtcIlNhZmFyaUNvbnRlbnRCcm93c2VyVGFiUHJveHlcIl0pXG5cdFx0XHRcdFx0XHRcdCg8YW55PnNhZmFyaS5zZWxmKS50YWIuZGlzcGF0Y2hNZXNzYWdlKFwiZXh0ZW5zaW9uTWVzc2FnZVJlc3BvbnNlXCIsIG1lc3NhZ2VEYXRhLCBmYWxzZSk7XG5cdFx0XHRcdFx0XHRlbHNlIGlmKHNhZmFyaS5hcHBsaWNhdGlvbi5hY3RpdmVCcm93c2VyV2luZG93ICE9IG51bGwgJiYgc2FmYXJpLmFwcGxpY2F0aW9uLmFjdGl2ZUJyb3dzZXJXaW5kb3cuYWN0aXZlVGFiLnBhZ2UgaW5zdGFuY2VvZiAoPGFueT53aW5kb3cpW1wiU2FmYXJpV2ViUGFnZVByb3h5XCJdKVxuXHRcdFx0XHRcdFx0XHRzYWZhcmkuYXBwbGljYXRpb24uYWN0aXZlQnJvd3NlcldpbmRvdy5hY3RpdmVUYWIucGFnZS5kaXNwYXRjaE1lc3NhZ2UoXCJleHRlbnNpb25NZXNzYWdlUmVzcG9uc2VcIiwgbWVzc2FnZURhdGEpO1xuXHRcdFx0XHRcdFx0XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRcblx0XHRcdGlmKHR5cGVvZiBzYWZhcmkuYXBwbGljYXRpb24gPT09IFwib2JqZWN0XCIpXG5cdFx0XHRcdHNhZmFyaS5hcHBsaWNhdGlvbi5hZGRFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBldmVudEhhbmRsZXIsIGZhbHNlKTtcblx0XHRcdGVsc2UgaWYodHlwZW9mIHNhZmFyaS5zZWxmID09PSBcIm9iamVjdFwiKSB7XG5cdFx0XHRcdCg8YW55PnNhZmFyaS5zZWxmKS5hZGRFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBldmVudEhhbmRsZXIsIGZhbHNlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybihcIkNvdWxkIG5vdCBmaW5kIHNhZmFyaS5hcHBsaWNhdGlvbiBvciBzYWZhcmkuc2VsZiB0byBhZGQgbWVzc2FnZSBldmVudCBsaXN0ZW5lci5cIik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xuXHRcblx0Ly8gSGFuZGxlIG1lc3NhZ2UgcmVzcG9uc2VzXG5cdGlmKElTX0NIUk9NRSlcblx0e1xuXHRcdGNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigocmVxdWVzdCwgc2VuZGVyLCBzZW5kUmVzcG9uc2UpID0+IHtcblx0XHRcdGlmKHJlcXVlc3QucmVzcG9uc2VUbylcblx0XHRcdHtcblx0XHRcdFx0dmFyIHJlc3BvbnNlSGFuZGxlciA9IHNhZmFyaU1lc3NhZ2VSZXNwb25zZUhhbmRsZXJzW3JlcXVlc3QucmVzcG9uc2VUb107XG5cdFx0XHRcdFxuXHRcdFx0XHRpZihyZXNwb25zZUhhbmRsZXIpXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRyZXNwb25zZUhhbmRsZXIocmVxdWVzdC5tZXNzYWdlKTtcblx0XHRcdFx0XHRkZWxldGUgc2FmYXJpTWVzc2FnZVJlc3BvbnNlSGFuZGxlcnNbcmVxdWVzdC5yZXNwb25zZVRvXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cdGVsc2UgaWYoSVNfU0FGQVJJKVxuXHR7XG5cdFx0dmFyIGV2ZW50SGFuZGxlciA9IChldmVudDogYW55KSA9PiB7XG5cdFx0XHRpZihldmVudC5uYW1lID09PSBcImV4dGVuc2lvbk1lc3NhZ2VSZXNwb25zZVwiKVxuXHRcdFx0e1xuXHRcdFx0XHR2YXIgcmVzcG9uc2VIYW5kbGVyID0gc2FmYXJpTWVzc2FnZVJlc3BvbnNlSGFuZGxlcnNbZXZlbnQubWVzc2FnZS5yZXNwb25zZVRvXTtcblx0XHRcdFx0XG5cdFx0XHRcdGlmKHJlc3BvbnNlSGFuZGxlcilcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHJlc3BvbnNlSGFuZGxlcihldmVudC5tZXNzYWdlLm1lc3NhZ2UpO1xuXHRcdFx0XHRcdGRlbGV0ZSBzYWZhcmlNZXNzYWdlUmVzcG9uc2VIYW5kbGVyc1tldmVudC5tZXNzYWdlLnJlc3BvbnNlVG9dO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRcblx0XHRpZih0eXBlb2Ygc2FmYXJpLmFwcGxpY2F0aW9uID09PSBcIm9iamVjdFwiKVxuXHRcdFx0c2FmYXJpLmFwcGxpY2F0aW9uLmFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGV2ZW50SGFuZGxlciwgZmFsc2UpO1xuXHRcdGVsc2UgaWYodHlwZW9mIHNhZmFyaS5zZWxmID09PSBcIm9iamVjdFwiKSB7XG5cdFx0XHQoPGFueT5zYWZhcmkuc2VsZikuYWRkRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgZXZlbnRIYW5kbGVyLCBmYWxzZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnNvbGUud2FybihcIkNvdWxkIG5vdCBmaW5kIHNhZmFyaS5hcHBsaWNhdGlvbiBvciBzYWZhcmkuc2VsZiB0byBhZGQgbWVzc2FnZSBldmVudCBsaXN0ZW5lci5cIik7XG5cdFx0fVxuXHR9XG59XG5cbi8qICFTdG9yYWdlICovXG5uYW1lc3BhY2UgZXh0ZW5zaW9uLnN0b3JhZ2Uge1xuXHRleHBvcnQgZnVuY3Rpb24gc2V0KG9iamVjdDogeyBbaWQ6IHN0cmluZ10gOiBhbnk7IH0sIGNhbGxiYWNrPzogKCkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGlmKElTX1NBRkFSSSkge1xuXHRcdFx0Zm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdHZhciBqc29uID0gSlNPTi5zdHJpbmdpZnkob2JqZWN0W2tleV0pO1xuXHRcdFx0XHRcdHNhZmFyaS5leHRlbnNpb24uc2VjdXJlU2V0dGluZ3Muc2V0SXRlbShrZXksIGpzb24pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhdGNoKGV4Y2VwdGlvbikge1xuXHRcdFx0XHRcdGNvbnNvbGUud2FybihcIkVycm9yIHdoaWxlIHN0b3JpbmcgaXRlbSB3aXRoIGtleSAlc1wiLCBrZXkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZihjYWxsYmFjaykge1xuXHRcdFx0XHRjYWxsYmFjaygpO1xuICAgICAgICAgICAgfVxuXHRcdH1cblx0XHRcblx0XHRpZiAoSVNfQ0hST01FKSB7XG5cdFx0XHRjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQob2JqZWN0LCBjYWxsYmFjayk7XG5cdFx0fVxuXHR9O1xuXHRcblx0ZXhwb3J0IGZ1bmN0aW9uIGdldChrZXlzOiBBcnJheTxzdHJpbmc+fHN0cmluZywgY2FsbGJhY2s6IChpdGVtczogeyBba2V5OiBzdHJpbmddIDogYW55fSkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGlmKCFBcnJheS5pc0FycmF5KGtleXMpKSB7XG4gICAgICAgICAgICB2YXIga2V5ID0gKDxzdHJpbmc+a2V5cyk7XG5cdFx0XHRrZXlzID0gW2tleV07XG4gICAgICAgIH1cblx0XHRcblx0XHRpZihJU19TQUZBUkkpIHtcblx0XHRcdHZhciByZXN1bHQ6IHtba2V5OiBzdHJpbmddIDogYW55fSA9IHt9O1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0dmFyIGpzb24gPSBzYWZhcmkuZXh0ZW5zaW9uLnNlY3VyZVNldHRpbmdzLmdldEl0ZW0oa2V5c1tpXSk7XG5cdFx0XHRcdFx0cmVzdWx0W2tleXNbaV1dID0gSlNPTi5wYXJzZShqc29uKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXRjaChleGNlcHRpb24pIHtcblx0XHRcdFx0XHRjb25zb2xlLmxvZyhcIkVycm9yIHdoaWxlIHJldHJldmluZyBzdG9yYWdlIGl0ZW0gd2l0aCBrZXkgJXNcIiwga2V5c1tpXSk7XG5cdFx0XHRcdFx0cmVzdWx0W2tleXNbaV1dID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y2FsbGJhY2socmVzdWx0KTtcblx0XHR9XG5cdFx0XG5cdFx0aWYoSVNfQ0hST01FKSB7XG5cdFx0XHRjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoa2V5cywgKHN0b3JhZ2VJdGVtcykgPT4ge1xuXHRcdFx0XHRpZiAoIXN0b3JhZ2VJdGVtcykge1xuXHRcdFx0XHRcdHN0b3JhZ2VJdGVtcyA9IHt9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRpZih0eXBlb2Ygc3RvcmFnZUl0ZW1zW2tleXNbaV1dID09PSBcInVuZGVmaW5lZFwiKVxuXHRcdFx0XHRcdFx0c3RvcmFnZUl0ZW1zW2tleXNbaV1dID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0Y2FsbGJhY2soc3RvcmFnZUl0ZW1zKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fTtcblx0XG5cdGV4cG9ydCBmdW5jdGlvbiByZW1vdmUoa2V5czogQXJyYXk8c3RyaW5nPnxzdHJpbmcsIGNhbGxiYWNrPzogKCkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGlmKCFBcnJheS5pc0FycmF5KGtleXMpKSB7XG4gICAgICAgICAgICB2YXIga2V5ID0gKDxzdHJpbmc+a2V5cyk7XG5cdFx0XHRrZXlzID0gW2tleV07XG4gICAgICAgIH1cblx0XHRcblx0XHRpZihJU19TQUZBUkkpIHtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRzYWZhcmkuZXh0ZW5zaW9uLnNlY3VyZVNldHRpbmdzLnJlbW92ZUl0ZW0oa2V5c1tpXSk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdGlmKGNhbGxiYWNrKSB7XG5cdFx0XHRcdGNhbGxiYWNrKCk7XG4gICAgICAgICAgICB9XG5cdFx0fVxuXHRcdFxuXHRcdGlmKElTX0NIUk9NRSkge1xuXHRcdFx0Y2hyb21lLnN0b3JhZ2UubG9jYWwucmVtb3ZlKDxzdHJpbmdbXT5rZXlzLCBjYWxsYmFjayk7XG5cdFx0fVxuXHR9O1xuXHRcblx0ZXhwb3J0IGZ1bmN0aW9uIGNsZWFyKGNhbGxiYWNrPzogKCkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGlmKElTX1NBRkFSSSkge1xuXHRcdFx0c2FmYXJpLmV4dGVuc2lvbi5zZWN1cmVTZXR0aW5ncy5jbGVhcigpO1xuXHRcdFx0aWYoY2FsbGJhY2spIHtcblx0XHRcdFx0Y2FsbGJhY2soKTtcbiAgICAgICAgICAgIH1cblx0XHR9XG5cdFx0XG5cdFx0aWYoSVNfQ0hST01FKSB7XG5cdFx0XHRjaHJvbWUuc3RvcmFnZS5sb2NhbC5jbGVhcihjYWxsYmFjayk7XG5cdFx0fVxuXHR9O1xuXHRcblx0ZXhwb3J0IGZ1bmN0aW9uIGFkZEV2ZW50TGlzdGVuZXIoZXZlbnRIYW5kbGVyOiAoc3RvcmFnZUNoYW5nZXM6IHtba2V5OiBzdHJpbmddOiBjaHJvbWUuc3RvcmFnZS5TdG9yYWdlQ2hhbmdlfSkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGlmKElTX1NBRkFSSSkge1xuXHRcdFx0aWYgKCFzYWZhcmkuZXh0ZW5zaW9uLnNlY3VyZVNldHRpbmdzKVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR2YXIgY2FjaGVkQ2hhbmdlczoge1trZXk6IHN0cmluZ106IGNocm9tZS5zdG9yYWdlLlN0b3JhZ2VDaGFuZ2V9ID0ge307XG5cdFx0XHRcblx0XHRcdHNhZmFyaS5leHRlbnNpb24uc2VjdXJlU2V0dGluZ3MuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCAoZXZlbnQ6U2FmYXJpRXh0ZW5zaW9uU2V0dGluZ3NDaGFuZ2VFdmVudCkgPT4ge1xuXHRcdFx0XHRpZihldmVudC5vbGRWYWx1ZSAhPSBldmVudC5uZXdWYWx1ZSkge1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdC8vIFdhaXQgZm9yIG90aGVyIGNoYW5nZXMgc28gdGhleSBjYW4gYmUgYnVuZGxlZCBpbiAxIGV2ZW50XG5cdFx0XHRcdFx0aWYoT2JqZWN0LmtleXMoY2FjaGVkQ2hhbmdlcykubGVuZ3RoID09IDApIHtcblx0XHRcdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRldmVudEhhbmRsZXIoY2FjaGVkQ2hhbmdlcyk7XG5cdFx0XHRcdFx0XHRcdGNhY2hlZENoYW5nZXMgPSB7fTtcblx0XHRcdFx0XHRcdH0sIDEwMDApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcblx0XHRcdFx0XHRjYWNoZWRDaGFuZ2VzW2V2ZW50LmtleV0gPSB7IG9sZFZhbHVlOiBldmVudC5vbGRWYWx1ZSwgbmV3VmFsdWU6IGV2ZW50Lm5ld1ZhbHVlIH07XG5cdFx0XHRcdH1cblx0XHRcdH0sIGZhbHNlKTtcblx0XHR9XG5cdFx0XG5cdFx0aWYoSVNfQ0hST01FKSB7XG5cdFx0XHRjaHJvbWUuc3RvcmFnZS5vbkNoYW5nZWQuYWRkTGlzdGVuZXIoKGNoYW5nZXMsIGFyZWFOYW1lKSA9PiB7XG5cdFx0XHRcdGlmKGFyZWFOYW1lID09IFwibG9jYWxcIikge1xuXHRcdFx0XHRcdGV2ZW50SGFuZGxlcihjaGFuZ2VzKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9O1xufSJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==

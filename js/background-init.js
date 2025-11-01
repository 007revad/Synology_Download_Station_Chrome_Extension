/// <reference path="../../typings/index.d.ts"/>
/// Service Worker compatible background script (no DOM/jQuery dependencies)

var downloadStation = null;

// Initialize immediately (no document.ready needed in service worker)
(function initialize() {
    updateToolbarIcon(null);
    extension.setBadge(0);
    
    extension.storage.get("firstLaunch", function (storageItems) {
        if (storageItems["firstLaunch"] == false) {
            // Already initialized
        }
        else {
            // Set default settings
            var defaults = {
                protocol: "http://",
                firstLaunch: false,
                hideSeedingTorrents: false,
                //updateInBackground: true,
                updateInBackground: false,
                openProtocols: ["magnet:?", "ed2k://", "thunder://", "flashget://", "qqdl://"],
                backgroundUpdateInterval: 20,
                notifiedTasks: []
            };
            extension.storage.set(defaults);
            extension.createTab("options.html");
        }
        
        if (extension.safariCheckForUpdate) {
            extension.safariCheckForUpdate();
        }
        
        bindEventListeners();
        init();
        
        setTimeout(function() {
            if (extension.safariCheckForUpdate) {
                extension.safariCheckForUpdate();
            }
        }, 10000);
    });
})();

function bindEventListeners() {
    extension.onMessage(function (event, sendResponse) {
        switch (event.name) {
            case "testConnection":
                testConnection(event.message, function (success, message, deviceInfo) {
                    sendResponse({ success: success, message: message, deviceInfo: deviceInfo });
                });
                break;
            case "getSettings":
                getExtensionSettings(function (settings) {
                    sendResponse(settings);
                });
                break;
            case "saveConnectionSettings":
                if (event.message.quickConnectId) {
                    event.message.url = null;
                    event.message.port = null;
                    event.message.protocol = null;
                }
                else {
                    event.message.quickConnectId = null;
                }
                testConnection(event.message, function (success, message) {
                    if (success === true)
                        extension.storage.set(event.message);
                    sendResponse({ success: success, message: message });
                });
                break;
            case "saveOtherSettings":
                extension.storage.set(event.message);
                sendResponse({ success: true });
                break;
            case "getProtocols":
                extension.storage.get("openProtocols", function (storageItems) {
                    var openProtocols = storageItems["openProtocols"];
                    if (!Array.isArray(openProtocols))
                        openProtocols = [];
                    sendResponse(openProtocols);
                });
                break;
            case "addTask":
                if (!downloadStation) {
                    sendResponse({
                        success: false,
                        data: "couldNotConnect"
                    });
                }
                else {
                    var m = event.message;
                    downloadStation.createTask(m.url, m.username, m.password, m.unzipPassword, m.destinationFolder, function (success, data) {
                        if (typeof sendResponse === "function") {
                            sendResponse({
                                success: success,
                                data: data
                            });
                        }
                    });
                }
                break;
            case "addTaskWithHud":
                createTaskWithHud(event.message.url, event.message.username, event.message.password, event.message.unzipPassword);
                break;
            case "sendRemoveDialogMessage":
                extension.sendMessageToContent("removeDialog", event.message);
                break;
            case "listFolders":
                if (!downloadStation) {
                    sendResponse({
                        success: false,
                        data: "couldNotConnect"
                    });
                }
                else {
                    downloadStation.fileStation.listFolders(event.message, function (success, data) {
                        sendResponse({
                            success: success,
                            data: data
                        });
                    });
                }
                break;
            case "createFolder":
                if (!downloadStation) {
                    sendResponse({
                        success: false,
                        data: "couldNotConnect"
                    });
                }
                else {
                    downloadStation.fileStation.fileStationCreateFolder(event.message.path, event.message.name, function (success, data, errors) {
                        sendResponse({
                            success: success,
                            data: data,
                            errors: errors
                        });
                    });
                }
                break;
            case "rename":
                if (!downloadStation) {
                    sendResponse({
                        success: false,
                        data: "couldNotConnect"
                    });
                }
                else {
                    downloadStation.fileStation.fileStationRename(event.message.path, event.message.name, function (success, data, errors) {
                        sendResponse({
                            success: success,
                            data: data,
                            errors: errors
                        });
                    });
                }
                break;
            case "delete":
                if (!downloadStation) {
                    sendResponse({
                        success: false,
                        data: "couldNotConnect"
                    });
                }
                else {
                    downloadStation.fileStation.fileStationDelete(event.message.path, function (success, data, errors) {
                        sendResponse({
                            success: success,
                            data: data,
                            errors: errors
                        });
                    });
                }
                break;
            case "getSupportedFeatures":
                if (!downloadStation) {
                    sendResponse(null);
                }
                else {
                    downloadStation.getSupportedFeatures(function (features) {
                        sendResponse(features);
                    });
                }
                break;
        }
    });

    extension.storage.addEventListener(function (changes) {
        var changedItems = Object.keys(changes);
        if (changedItems.indexOf("quickConnectId") != -1 ||
            changedItems.indexOf("username") != -1 || changedItems.indexOf("password") != -1 ||
            changedItems.indexOf("protocol") != -1 || changedItems.indexOf("url") != -1 ||
            changedItems.indexOf("port") != -1) {
            init();
        }
        else if (downloadStation != null && (changedItems.indexOf("backgroundUpdateInterval") != -1 || changedItems.indexOf("updateInBackground") != -1)) {
            extension.storage.get(["backgroundUpdateInterval", "updateInBackground"], function (storageItems) {
                downloadStation.setBackgroundUpdate(storageItems["updateInBackground"], storageItems["backgroundUpdateInterval"]);
            });
        }
    });
}

function init() {
    if (downloadStation != null) {
        downloadStation.destroy(function () {
            downloadStation = null;
            init();
        });
    }
    else {
        extension.storage.get(["quickConnectId", "protocol", "url", "port", "username", "password", "backgroundUpdateInterval", "updateInBackground", "hideSeedingTorrents"], function (storageItems) {
            var options = storageItems;
            
            if (!options.username || options.username.length == 0) {
                updateToolbarIcon(null);
                extension.setBadge(0);
                return;
            }

            downloadStation = new DownloadStationAPI(options);

            downloadStation.addEventListener("taskUpdate", function () {
                var count = downloadStation.getTasks().length;
                if (downloadStation.hideSeedingTorrents) {
                    var seedingCount = downloadStation.getSeedingTasks().length;
                    count = count - seedingCount;
                }
                extension.setBadge(count);

                if (downloadStation.tasks.length > 0) {
                    var taskSpeed = downloadStation.getTaskSpeed();
                    extension.updateBadgeOptions(taskSpeed);
                }
                var finishedTasks = downloadStation.getFinishedTasks();
                if (finishedTasks.length > 0) {
                    showFinishedTaskNotifications(finishedTasks);
                }
            });

            // ✅ FIXED: Toolbar icon update - Icon listener is set up correctly
            downloadStation.addEventListener(["connected", "connectionLost", "loginStatusChange"], function () {
                // Add a small delay to ensure deviceInfo is updated before checking
                setTimeout(function() {
                    updateToolbarIcon(downloadStation);
                }, 100);
            });

            var contextMenuItemID = "dsContextMenuItem";
            var contextMenuItemIDAdvanced = "dsContextMenuItemAdvanced";
            var contextMenuItemText = extension.getLocalizedString("contextMenuDownloadOn", [downloadStation.deviceInfo.deviceName]);
            extension.createContextMenuItem({
                id: contextMenuItemID,
                title: contextMenuItemText,
                enabled: true,
                contexts: ["selection", "link", "image", "video", "audio"],
                onclick: function (info, tab) {
                    var url = null;
                    if (info.linkUrl) {
                        url = stringReplaceAll(info.linkUrl, " ", "%20");
                    }
                    else if (info.srcUrl) {
                        url = stringReplaceAll(info.srcUrl, " ", "%20");
                    }
                    else if (info.selectionText) {
                        url = info.selectionText;
                    }
                    createTaskWithHud(url);
                }
            });

            extension.createContextMenuItem({
                id: contextMenuItemIDAdvanced,
                title: extension.getLocalizedString("contextMenuDownloadAdvanced"),
                enabled: true,
                contexts: ["selection", "link", "image", "video", "audio"],
                onclick: function (info, tab) {
                    var url = null;
                    if (info.linkUrl) {
                        url = stringReplaceAll(info.linkUrl, " ", "%20");
                    }
                    else if (info.srcUrl) {
                        url = stringReplaceAll(info.srcUrl, " ", "%20");
                    }
                    else if (info.selectionText) {
                        url = info.selectionText;
                    }
                    extension.sendMessageToContent("openDownloadDialog", { url: url });
                }
            });

            downloadStation.addEventListener("destroy", function () {
                extension.removeContextMenuItem(contextMenuItemID);
                extension.removeContextMenuItem(contextMenuItemIDAdvanced);
            });

            downloadStation.startBackgroundUpdate();
        }
    });
}

function updateToolbarIcon(downloadStation) {
    console.log('Icon update check - connected:', downloadStation.connected, 'loggedIn:', downloadStation.deviceInfo.loggedIn);
    if (downloadStation && downloadStation.deviceInfo && downloadStation.deviceInfo.loggedIn && downloadStation.connected) {
        if (IS_CHROME) {
            // ✅ FIXED: Added 'images/' prefix to icon paths
            chrome.action.setIcon({ path: { '19': 'images/Icon-19.png', '38': 'images/Icon-38.png' } });
        }
    }
    else {
        if (IS_CHROME) {
            // ✅ FIXED: Added 'images/' prefix to icon paths
            chrome.action.setIcon({ path: { '19': 'images/Icon-19-disconnected.png', '38': 'images/Icon-38-disconnected.png' } });
        }
    }
}

function showFinishedTaskNotifications(finishedTasks) {
    extension.storage.get("notifiedTasks", function (storageItems) {
        var toNotify = [];
        var notified = storageItems["notifiedTasks"];
        if (!Array.isArray(notified))
            notified = [];
        
        $.each(finishedTasks, function (index, task) {
            if (notified.indexOf(task.id) == -1) {
                toNotify.push(task);
                notified.push(task.id);
            }
        });
        
        extension.storage.set({ notifiedTasks: notified });
        
        if (toNotify.length == 1) {
            extension.showNotification(extension.getLocalizedString('downloadFinished'), toNotify[0].title);
        }
        else if (toNotify.length > 1) {
            var message = extension.getLocalizedString('numberTasksFinished', [toNotify.length.toString()]);
            extension.showNotification(extension.getLocalizedString('downloadsFinished'), message);
        }
    });
}

function getExtensionSettings(callback) {
    extension.storage.get(["quickConnectId", "protocol", "url", "port", "username", "password",
        "backgroundUpdateInterval", "updateInBackground",
        "openProtocols", "hideSeedingTorrents", "email"], function (storageItems) {
        if (!Array.isArray(storageItems.openProtocols)) {
            storageItems.openProtocols = [];
        }
        callback(storageItems);
    });
}

function testConnection(options, callback) {
    var testOptions = {};
    $.extend(testOptions, options);
    testOptions.updateInBackground = false;
    var dsInstance = new DownloadStationAPI(testOptions);
    dsInstance.loadTasks(function (success, data) {
        if (success === false) {
            callback(success, extension.getLocalizedString("api_error_" + data));
        }
        else {
            callback(success, extension.getLocalizedString("testResultSuccess"), dsInstance.deviceInfo);
        }
        dsInstance.destroy();
        dsInstance = null;
    });
}

function updateHud(hudItem) {
    extension.sendMessageToContent("hud", hudItem);
}

function getDeviceInfo() {
    return downloadStation ? downloadStation.deviceInfo : null;
}

function getTasks() {
    if (downloadStation == null)
        return [];
    return downloadStation.tasks;
}

function createTask(url, username, password, unzipPassword, callback) {
    if (downloadStation != null) {
        downloadStation.createTask(url, username, password, unzipPassword, null, callback);
    }
}

function createTaskWithHud(url, username, password, unzipPassword, callback) {
    if (downloadStation != null) {
        updateHud({ action: "show", icon: "progress", text: extension.getLocalizedString("downloadTaskAdding"), autoHide: false });
        downloadStation.createTask(url, username, password, unzipPassword, null, function (success, message) {
            if (success) {
                updateHud({ action: "show", icon: "check", text: extension.getLocalizedString("downloadTaskAccepted"), autoHide: true });
            }
            else {
                updateHud({ action: "show", icon: "cross", text: extension.getLocalizedString("api_error_" + message), autoHide: true });
            }
            if (callback) {
                callback(success, message);
            }
        });
    }
    else {
        updateHud({ action: "show", icon: "cross", text: extension.getLocalizedString("api_error_couldNotConnect"), autoHide: true });
    }
}

function resumeTask(ids, callback) {
    if (downloadStation != null) {
        downloadStation.resumeTask(ids, callback);
    }
}

function pauseTask(ids, callback) {
    if (downloadStation != null) {
        downloadStation.pauseTask(ids, callback);
    }
}

function deleteTask(ids, callback) {
    if (downloadStation != null) {
        downloadStation.deleteTask(ids, callback);
    }
}

function clearFinishedTasks(callback) {
    if (downloadStation != null) {
        downloadStation.clearFinishedTasks(function (success, data) {
            if (success) {
                extension.storage.set({ notifiedTasks: [] });
            }
            callback(success, data);
        });
    }
}

function setUpdateInterval(seconds) {
    if (downloadStation != null) {
        downloadStation.startBackgroundUpdate(seconds);
    }
}

function stringReplaceAll(subject, search, replace, ignore) {
    if (typeof subject !== "string")
        return subject;
    return subject.replace(new RegExp(search.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g, "\\$&"), (ignore ? "gi" : "g")), (typeof (replace) == "string") ? replace.replace(/\$/g, "$$$$") : replace);
}

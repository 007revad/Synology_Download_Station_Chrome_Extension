/// <reference path="../../typings/index.d.ts"/>
/// <reference path="./variables.ts"/>
var downloadStation = null;
$(document).ready(function () {
    updateToolbarIcon(null);
    extension.setBadge(0);
    extension.storage.get("firstLaunch", function (storageItems) {
        if (localStorage.getItem("firstLaunch") == "false" || storageItems["firstLaunch"] == false) {
        }
        else {
            // Set default settings
            var defaults = {
                protocol: "http://",
                firstLaunch: false,
                hideSeedingTorrents: false,
                updateInBackground: true,
                openProtocols: ["magnet:?", "ed2k://", "thunder://", "flashget://", "qqdl://"],
                backgroundUpdateInterval: 20,
                notifiedTasks: new Array()
            };
            extension.storage.set(defaults);
            extension.createTab("options.html");
            _gaq.push(['_trackEvent', 'Startup', 'Installed', extension.getExtensionVersion()]);
        }
        extension.safariCheckForUpdate();
        checkDonationNotification();
        bindEventListeners();
        init();
        setTimeout(extension.safariCheckForUpdate, 10000);
    });
    if (IS_SAFARI) {
        safari.application.addEventListener("open", function () {
            updateToolbarIcon(downloadStation);
        }, true);
    }
});
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
                // Make sure that the other settings are cleared when switching between QuickConnect and manual connection
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
                        openProtocols = new Array();
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
                _gaq.push(['_trackEvent', 'Button', event.message.taskType]);
                break;
            case "addTaskWithHud":
                createTaskWithHud(event.message.url, event.message.username, event.message.password, event.message.unzipPassword);
                _gaq.push(['_trackEvent', 'Button', event.message.taskType]);
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
    // Disconnect from DS with old settings
    if (downloadStation != null) {
        downloadStation.destroy(function () {
            downloadStation = null;
            init();
        });
        return;
    }
    getExtensionSettings(function (settings) {
        if (settings.username !== null &&
            settings.password !== null &&
            (settings.quickConnectId || (settings.protocol && settings.url && settings.port))) {
            $.each(extension.getPopovers(), function (index, popover) {
                try {
                    if (popover.updateDeviceInfo) {
                        popover.updateDeviceInfo(getDeviceInfo());
                    }
                }
                catch (exception) {
                    console.error(exception);
                }
            });
            downloadStation = new DownloadStationAPI(settings);
            var connectionType = settings.quickConnectId ? "QuickConnect" : "Manual";
            _gaq.push(['_trackEvent', 'DiskStation', 'Connection type', connectionType], ['_trackEvent', 'DiskStation', 'Protocol', settings.protocol], ['_trackEvent', 'DiskStation', 'Update interval', settings.backgroundUpdateInterval], ['_trackEvent', 'DiskStation', 'Hide seeding torrents', settings.hideSeedingTorrents]);
            downloadStation.addEventListener("deviceInfoUpdated", function () {
                _gaq.push(['_trackEvent', 'DiskStation', 'DS build', downloadStation._version], ['_trackEvent', 'DiskStation', 'DS version', downloadStation._versionString], ['_trackEvent', 'DiskStation', 'DSM version', downloadStation.deviceInfo.dsmVersionString], ['_trackEvent', 'DiskStation', 'DSM build', downloadStation.deviceInfo.dsmVersion], ['_trackEvent', 'DiskStation', 'Model', downloadStation.deviceInfo.modelName]);
            });
            // !Popover login status
            downloadStation.addEventListener(["loginStatusChange", "deviceInfoUpdated", "connectionStatusUpdated"], function () {
                var popovers = extension.getPopovers();
                $.each(popovers, function (index, popover) {
                    try {
                        popover.updateDeviceInfo(downloadStation.deviceInfo);
                    }
                    catch (exception) {
                        console.log(exception);
                    }
                });
            });
            // !Popover task list
            downloadStation.addEventListener("tasksUpdated", function () {
                var popovers = extension.getPopovers();
                $.each(popovers, function (index, popover) {
                    try {
                        popover.updateTasks(downloadStation.tasks);
                    }
                    catch (exception) {
                        console.log(exception);
                    }
                });
            });
            // !Badge
            downloadStation.addEventListener("tasksUpdated", function () {
                var badgeText = 0;
                if (downloadStation && downloadStation.connected == true && downloadStation.tasks.length > 0) {
                    var finishedTasks = downloadStation.getFinishedTasks();
                    badgeText = finishedTasks.length;
                }
                extension.setBadge(badgeText);
            });
            // !Notifications
            downloadStation.addEventListener("tasksUpdated", function () {
                if (!downloadStation._settings.updateInBackground) {
                    return;
                }
                var finishedTasks = downloadStation.getFinishedTasks();
                if (finishedTasks.length > 0) {
                    showFinishedTaskNotifications(finishedTasks);
                }
            });
            // !Toolbar icon
            downloadStation.addEventListener(["connected", "connectionLost", "loginStatusChange"], function () {
                updateToolbarIcon(downloadStation);
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
                    var itemType = "None";
                    if (info.linkUrl) {
                        url = stringReplaceAll(info.linkUrl, " ", "%20");
                        itemType = "Link";
                    }
                    else if (info.srcUrl) {
                        url = stringReplaceAll(info.srcUrl, " ", "%20");
                        itemType = "Source (video/audio/image)";
                    }
                    else if (info.selectionText) {
                        url = info.selectionText;
                        itemType = "Selection";
                    }
                    _gaq.push(['_trackEvent', 'Button', 'ContextMenu', itemType]);
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
                    var itemType = "None";
                    if (info.linkUrl) {
                        url = stringReplaceAll(info.linkUrl, " ", "%20");
                        itemType = "Link";
                    }
                    else if (info.srcUrl) {
                        url = stringReplaceAll(info.srcUrl, " ", "%20");
                        itemType = "Source (video/audio/image)";
                    }
                    else if (info.selectionText) {
                        url = info.selectionText;
                        itemType = "Selection";
                    }
                    _gaq.push(['_trackEvent', 'Button', 'ContextMenuAdvanced', itemType]);
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
    if (downloadStation && downloadStation.deviceInfo && downloadStation.deviceInfo.loggedIn && downloadStation.connected) {
        if (IS_CHROME)
            chrome.browserAction.setIcon({ path: { '19': 'Icon-19.png', '38': 'Icon-38.png' } });
        else if (IS_SAFARI) {
            for (var i = 0; i < safari.extension.toolbarItems.length; i++) {
                safari.extension.toolbarItems[i].image = extension.getResourceURL("css/img/icon-black.png");
            }
        }
    }
    else {
        if (IS_CHROME)
            chrome.browserAction.setIcon({ path: { '19': 'Icon-19-disconnected.png', '38': 'Icon-38-disconnected.png' } });
        else if (IS_SAFARI) {
            for (var i = 0; i < safari.extension.toolbarItems.length; i++) {
                safari.extension.toolbarItems[i].image = extension.getResourceURL("css/img/icon-black-disconnected.png");
            }
        }
    }
}
function showFinishedTaskNotifications(finishedTasks) {
    extension.storage.get("notifiedTasks", function (storageItems) {
        var toNotify = new Array();
        var notified = storageItems["notifiedTasks"];
        if (!Array.isArray(notified))
            notified = new Array();
        // Remove tasks from list for which a notification has been sent before
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
            storageItems.openProtocols = new Array();
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
        _gaq.push(['_trackEvent', 'Downloads', 'Add task']);
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
        _gaq.push(['_trackEvent', 'Downloads', 'Add task']);
    }
    else {
        updateHud({ action: "show", icon: "cross", text: extension.getLocalizedString("api_error_couldNotConnect"), autoHide: true });
    }
}
function resumeTask(ids, callback) {
    if (downloadStation != null) {
        downloadStation.resumeTask(ids, callback);
        _gaq.push(['_trackEvent', 'Downloads', 'Resume task', ids.length]);
    }
}
function pauseTask(ids, callback) {
    if (downloadStation != null) {
        downloadStation.pauseTask(ids, callback);
        _gaq.push(['_trackEvent', 'Downloads', 'Pause task', ids.length]);
    }
}
function deleteTask(ids, callback) {
    if (downloadStation != null) {
        downloadStation.deleteTask(ids, callback);
        _gaq.push(['_trackEvent', 'Downloads', 'Remove task', ids.length]);
    }
}
function clearFinishedTasks(callback) {
    if (downloadStation != null) {
        downloadStation.clearFinishedTasks(function (success, data) {
            if (success) {
                extension.storage.set({ notifiedTasks: new Array() });
            }
            callback(success, data);
        });
        _gaq.push(['_trackEvent', 'Downloads', 'Clear queue']);
    }
}
function setUpdateInterval(seconds) {
    if (downloadStation != null) {
        downloadStation.startBackgroundUpdate(seconds);
    }
}
function checkDonationNotification() {
    var now = new Date().getTime();
    var oneWeek = 604800000;
    extension.storage.get(["lastDonationNotification", "email"], function (storageItems) {
        var lastCheck = storageItems["lastDonationNotification"];
        var email = storageItems["email"];
        if (lastCheck == null) {
            lastCheck = now - (oneWeek * 3); // First notification after one week.
        }
        if ((now - lastCheck) > oneWeek * 4) {
            if (typeof email !== "string" || email.length === 0) {
                extension.storage.set({ lastDonationNotification: new Date().getTime() });
                showDonationNotification();
            }
            else {
                $.post(DONATION_CHECK_URL, { email: email })
                    .done(function (data) {
                    extension.storage.set({ lastDonationNotification: new Date().getTime() });
                    if (!data.result) {
                        showDonationNotification();
                    }
                }).fail(function (jqXHR, textStatus, errorThrown) {
                    _gaq.push(['_trackEvent', 'Donation check', 'Check failed', textStatus + ' - ' + errorThrown]);
                });
            }
        }
        else {
            extension.storage.set({ lastDonationNotification: lastCheck });
        }
    });
}
function showDonationNotification() {
    var medium = "unknown";
    if (IS_OPERA)
        medium = "Opera";
    else if (IS_CHROME)
        medium = "Chrome";
    else if (IS_SAFARI)
        medium = "Safari";
    var donationPageUrl = DONATION_URL + "?utm_source=extension&utm_medium=" + medium + "&utm_campaign=notification";
    var notification = extension.showNotification('Synology Download Station', extension.getLocalizedString('donationNotification'), true, donationPageUrl);
    if (notification == null && IS_OPERA) {
        extension.createTab(donationPageUrl);
    }
}
function stringReplaceAll(subject, search, replace, ignore) {
    if (typeof subject !== "string")
        return subject;
    return subject.replace(new RegExp(search.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g, "\\$&"), (ignore ? "gi" : "g")), (typeof (replace) == "string") ? replace.replace(/\$/g, "$$$$") : replace);
}
var _gaq = _gaq || [];
_gaq.push(['_setAccount', ANALYTICS_ID]);
_gaq.push(['_trackPageview']);
_gaq.push(['_trackEvent', 'Startup', 'ExtensionVersion', '' + extension.getExtensionVersion()]);
(function () {
    var ga = document.createElement('script');
    ga.type = 'text/javascript';
    ga.async = true;
    ga.src = 'https://ssl.google-analytics.com/ga.js';
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(ga, s);
})();

//# sourceMappingURL=data:application/json;base64,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QUMsb0JBQW9CLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbkQsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ2xDLENBQUMsQ0FBQyxFQUFFLENBQUMiLCJmaWxlIjoianMvYmFja2dyb3VuZC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi90eXBpbmdzL2luZGV4LmQudHNcIi8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi92YXJpYWJsZXMudHNcIi8+XG5cbmludGVyZmFjZSBJRXh0ZW5zaW9uU2V0dGluZ3Mge1xuICAgIHF1aWNrQ29ubmVjdElkOiBzdHJpbmc7XG4gICAgcHJvdG9jb2w6IHN0cmluZztcbiAgICB1cmw6IHN0cmluZztcbiAgICBwb3J0OiBudW1iZXI7XG4gICAgdXNlcm5hbWU6IHN0cmluZztcbiAgICBwYXNzd29yZDogc3RyaW5nO1xuICAgIGJhY2tncm91bmRVcGRhdGVJbnRlcnZhbDogbnVtYmVyO1xuICAgIHVwZGF0ZUluQmFja2dyb3VuZDogYm9vbGVhbjtcbiAgICBvcGVuUHJvdG9jb2xzOiBBcnJheTxzdHJpbmc+O1xuICAgIGhpZGVTZWVkaW5nVG9ycmVudHM6IGJvb2xlYW47XG4gICAgZW1haWw6IHN0cmluZztcbn1cblxudmFyIGRvd25sb2FkU3RhdGlvbjogRG93bmxvYWRTdGF0aW9uQVBJID0gbnVsbDtcblxuJChkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKSB7XG5cdHVwZGF0ZVRvb2xiYXJJY29uKG51bGwpO1xuXHRleHRlbnNpb24uc2V0QmFkZ2UoMCk7XG5cdGV4dGVuc2lvbi5zdG9yYWdlLmdldChcImZpcnN0TGF1bmNoXCIsIChzdG9yYWdlSXRlbXMpID0+IHtcblx0XHRpZihsb2NhbFN0b3JhZ2UuZ2V0SXRlbShcImZpcnN0TGF1bmNoXCIpID09IFwiZmFsc2VcIiB8fCBzdG9yYWdlSXRlbXNbXCJmaXJzdExhdW5jaFwiXSA9PSBmYWxzZSkge1xuXHRcdFx0Ly92YXIgdXBkYXRlciA9IG5ldyBFeHRlbnNpb25VcGRhdGVyKCk7XG5cdFx0XHQvL3VwZGF0ZXIucnVuKCk7XG5cdFx0XHQvL3VwZGF0ZXIgPSBudWxsO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdC8vIFNldCBkZWZhdWx0IHNldHRpbmdzXG5cdFx0XHR2YXIgZGVmYXVsdHMgPSB7XG5cdFx0XHRcdHByb3RvY29sOlx0XHRcdFx0XHRcImh0dHA6Ly9cIixcblx0XHRcdFx0Zmlyc3RMYXVuY2g6IFx0XHRcdFx0ZmFsc2UsXG5cdFx0XHRcdGhpZGVTZWVkaW5nVG9ycmVudHM6XHRcdGZhbHNlLFxuXHRcdFx0XHR1cGRhdGVJbkJhY2tncm91bmQ6XHRcdFx0dHJ1ZSxcblx0XHRcdFx0b3BlblByb3RvY29sczpcdFx0XHRcdFtcIm1hZ25ldDo/XCIsXCJlZDJrOi8vXCIsXCJ0aHVuZGVyOi8vXCIsXCJmbGFzaGdldDovL1wiLFwicXFkbDovL1wiXSxcblx0XHRcdFx0YmFja2dyb3VuZFVwZGF0ZUludGVydmFsOlx0MjAsXG5cdFx0XHRcdG5vdGlmaWVkVGFza3M6XHRcdFx0XHRuZXcgQXJyYXkoKVxuXHRcdFx0fTtcblx0XHRcdFxuXHRcdFx0ZXh0ZW5zaW9uLnN0b3JhZ2Uuc2V0KGRlZmF1bHRzKTtcblx0XHRcdGV4dGVuc2lvbi5jcmVhdGVUYWIoXCJvcHRpb25zLmh0bWxcIik7XG5cdFx0XHRfZ2FxLnB1c2goWydfdHJhY2tFdmVudCcsICdTdGFydHVwJywgJ0luc3RhbGxlZCcsIGV4dGVuc2lvbi5nZXRFeHRlbnNpb25WZXJzaW9uKCldKTtcblx0XHR9XG5cdFx0XG5cdFx0ZXh0ZW5zaW9uLnNhZmFyaUNoZWNrRm9yVXBkYXRlKCk7XG5cdFx0Y2hlY2tEb25hdGlvbk5vdGlmaWNhdGlvbigpO1xuXHRcdGJpbmRFdmVudExpc3RlbmVycygpO1xuXHRcdGluaXQoKTtcblx0XHRcblx0XHRzZXRUaW1lb3V0KGV4dGVuc2lvbi5zYWZhcmlDaGVja0ZvclVwZGF0ZSwgMTAwMDApO1xuXHR9KTtcblx0XG5cdGlmKElTX1NBRkFSSSkge1xuXHRcdHNhZmFyaS5hcHBsaWNhdGlvbi5hZGRFdmVudExpc3RlbmVyKFwib3BlblwiLCBmdW5jdGlvbigpIHtcblx0XHRcdHVwZGF0ZVRvb2xiYXJJY29uKGRvd25sb2FkU3RhdGlvbik7XG5cdFx0fSwgdHJ1ZSk7XG5cdH1cbn0pO1xuXG5mdW5jdGlvbiBiaW5kRXZlbnRMaXN0ZW5lcnMoKSB7XG5cdGV4dGVuc2lvbi5vbk1lc3NhZ2UoKGV2ZW50LCBzZW5kUmVzcG9uc2UpID0+IHtcblx0XHRzd2l0Y2goZXZlbnQubmFtZSlcblx0XHR7XG5cdFx0XHRjYXNlIFwidGVzdENvbm5lY3Rpb25cIjpcblx0XHRcdFx0dGVzdENvbm5lY3Rpb24oZXZlbnQubWVzc2FnZSwgKHN1Y2Nlc3MsIG1lc3NhZ2UsIGRldmljZUluZm8pID0+IHtcblx0XHRcdFx0XHRzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiBzdWNjZXNzLCBtZXNzYWdlOiBtZXNzYWdlLCBkZXZpY2VJbmZvOiBkZXZpY2VJbmZvIH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcblx0XHRcdGNhc2UgXCJnZXRTZXR0aW5nc1wiOlxuXHRcdFx0XHRnZXRFeHRlbnNpb25TZXR0aW5ncygoc2V0dGluZ3MpID0+IHtcblx0XHRcdFx0XHRzZW5kUmVzcG9uc2Uoc2V0dGluZ3MpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcblx0XHRcdGNhc2UgXCJzYXZlQ29ubmVjdGlvblNldHRpbmdzXCI6XG5cdFx0XHRcdC8vIE1ha2Ugc3VyZSB0aGF0IHRoZSBvdGhlciBzZXR0aW5ncyBhcmUgY2xlYXJlZCB3aGVuIHN3aXRjaGluZyBiZXR3ZWVuIFF1aWNrQ29ubmVjdCBhbmQgbWFudWFsIGNvbm5lY3Rpb25cblx0XHRcdFx0aWYoZXZlbnQubWVzc2FnZS5xdWlja0Nvbm5lY3RJZClcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGV2ZW50Lm1lc3NhZ2UudXJsID0gbnVsbDtcblx0XHRcdFx0XHRldmVudC5tZXNzYWdlLnBvcnQgPSBudWxsO1xuXHRcdFx0XHRcdGV2ZW50Lm1lc3NhZ2UucHJvdG9jb2wgPSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Vcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGV2ZW50Lm1lc3NhZ2UucXVpY2tDb25uZWN0SWQgPSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0XHR0ZXN0Q29ubmVjdGlvbihldmVudC5tZXNzYWdlLCAoc3VjY2VzcywgbWVzc2FnZSkgPT4ge1xuXHRcdFx0XHRcdGlmKHN1Y2Nlc3MgPT09IHRydWUpXG5cdFx0XHRcdFx0XHRleHRlbnNpb24uc3RvcmFnZS5zZXQoZXZlbnQubWVzc2FnZSk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0c2VuZFJlc3BvbnNlKHsgc3VjY2Vzczogc3VjY2VzcywgbWVzc2FnZTogbWVzc2FnZSB9KTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0XG5cdFx0XHRjYXNlIFwic2F2ZU90aGVyU2V0dGluZ3NcIjpcblx0XHRcdFx0ZXh0ZW5zaW9uLnN0b3JhZ2Uuc2V0KGV2ZW50Lm1lc3NhZ2UpO1xuXHRcdFx0XHRzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiB0cnVlIH0pO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdFx0XG5cdFx0XHRjYXNlIFwiZ2V0UHJvdG9jb2xzXCI6XG5cdFx0XHRcdGV4dGVuc2lvbi5zdG9yYWdlLmdldChcIm9wZW5Qcm90b2NvbHNcIiwgKHN0b3JhZ2VJdGVtcykgPT4ge1xuXHRcdFx0XHRcdHZhciBvcGVuUHJvdG9jb2xzOiBBcnJheTxzdHJpbmc+ID0gc3RvcmFnZUl0ZW1zW1wib3BlblByb3RvY29sc1wiXVxuXHRcdFx0XHRcdGlmKCFBcnJheS5pc0FycmF5KG9wZW5Qcm90b2NvbHMpKVxuXHRcdFx0XHRcdFx0b3BlblByb3RvY29scyA9IG5ldyBBcnJheTxzdHJpbmc+KCk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0c2VuZFJlc3BvbnNlKG9wZW5Qcm90b2NvbHMpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFwiYWRkVGFza1wiOlxuXHRcdFx0XHRpZighZG93bmxvYWRTdGF0aW9uKVxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0c2VuZFJlc3BvbnNlKHtcblx0XHRcdFx0XHRcdHN1Y2Nlc3M6IGZhbHNlLFxuXHRcdFx0XHRcdFx0ZGF0YTogXCJjb3VsZE5vdENvbm5lY3RcIlxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Vcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHZhciBtID0gZXZlbnQubWVzc2FnZTtcblx0XHRcdFx0XHRkb3dubG9hZFN0YXRpb24uY3JlYXRlVGFzayhtLnVybCwgbS51c2VybmFtZSwgbS5wYXNzd29yZCwgbS51bnppcFBhc3N3b3JkLCBtLmRlc3RpbmF0aW9uRm9sZGVyLCBmdW5jdGlvbihzdWNjZXNzLCBkYXRhKSB7XG5cdFx0XHRcdFx0XHRpZih0eXBlb2Ygc2VuZFJlc3BvbnNlID09PSBcImZ1bmN0aW9uXCIpXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdHNlbmRSZXNwb25zZSh7XG5cdFx0XHRcdFx0XHRcdFx0c3VjY2Vzczogc3VjY2Vzcyxcblx0XHRcdFx0XHRcdFx0XHRkYXRhOiBkYXRhXG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdF9nYXEucHVzaChbJ190cmFja0V2ZW50JywgJ0J1dHRvbicsIGV2ZW50Lm1lc3NhZ2UudGFza1R5cGVdKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFwiYWRkVGFza1dpdGhIdWRcIjpcblx0XHRcdFx0Y3JlYXRlVGFza1dpdGhIdWQoZXZlbnQubWVzc2FnZS51cmwsIGV2ZW50Lm1lc3NhZ2UudXNlcm5hbWUsIGV2ZW50Lm1lc3NhZ2UucGFzc3dvcmQsIGV2ZW50Lm1lc3NhZ2UudW56aXBQYXNzd29yZCk7XG5cdFx0XHRcdF9nYXEucHVzaChbJ190cmFja0V2ZW50JywgJ0J1dHRvbicsIGV2ZW50Lm1lc3NhZ2UudGFza1R5cGVdKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFwic2VuZFJlbW92ZURpYWxvZ01lc3NhZ2VcIjpcblx0XHRcdFx0ZXh0ZW5zaW9uLnNlbmRNZXNzYWdlVG9Db250ZW50KFwicmVtb3ZlRGlhbG9nXCIsIGV2ZW50Lm1lc3NhZ2UpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgXCJsaXN0Rm9sZGVyc1wiOlxuXHRcdFx0XHRpZighZG93bmxvYWRTdGF0aW9uKVxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0c2VuZFJlc3BvbnNlKHtcblx0XHRcdFx0XHRcdHN1Y2Nlc3M6IGZhbHNlLFxuXHRcdFx0XHRcdFx0ZGF0YTogXCJjb3VsZE5vdENvbm5lY3RcIlxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Vcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGRvd25sb2FkU3RhdGlvbi5maWxlU3RhdGlvbi5saXN0Rm9sZGVycyhldmVudC5tZXNzYWdlLCAoc3VjY2VzcywgZGF0YSkgPT4ge1xuXHRcdFx0XHRcdFx0c2VuZFJlc3BvbnNlKHtcblx0XHRcdFx0XHRcdFx0c3VjY2Vzczogc3VjY2Vzcyxcblx0XHRcdFx0XHRcdFx0ZGF0YTogZGF0YVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFwiY3JlYXRlRm9sZGVyXCI6XG5cdFx0XHRcdGlmKCFkb3dubG9hZFN0YXRpb24pXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRzZW5kUmVzcG9uc2Uoe1xuXHRcdFx0XHRcdFx0c3VjY2VzczogZmFsc2UsXG5cdFx0XHRcdFx0XHRkYXRhOiBcImNvdWxkTm90Q29ubmVjdFwiXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZVxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0ZG93bmxvYWRTdGF0aW9uLmZpbGVTdGF0aW9uLmZpbGVTdGF0aW9uQ3JlYXRlRm9sZGVyKGV2ZW50Lm1lc3NhZ2UucGF0aCwgZXZlbnQubWVzc2FnZS5uYW1lLCAoc3VjY2VzcywgZGF0YSwgZXJyb3JzKSA9PiB7XG5cdFx0XHRcdFx0XHRzZW5kUmVzcG9uc2Uoe1xuXHRcdFx0XHRcdFx0XHRzdWNjZXNzOiBzdWNjZXNzLFxuXHRcdFx0XHRcdFx0XHRkYXRhOiBkYXRhLFxuXHRcdFx0XHRcdFx0XHRlcnJvcnM6IGVycm9yc1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFwicmVuYW1lXCI6XG5cdFx0XHRcdGlmKCFkb3dubG9hZFN0YXRpb24pXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRzZW5kUmVzcG9uc2Uoe1xuXHRcdFx0XHRcdFx0c3VjY2VzczogZmFsc2UsXG5cdFx0XHRcdFx0XHRkYXRhOiBcImNvdWxkTm90Q29ubmVjdFwiXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZVxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0ZG93bmxvYWRTdGF0aW9uLmZpbGVTdGF0aW9uLmZpbGVTdGF0aW9uUmVuYW1lKGV2ZW50Lm1lc3NhZ2UucGF0aCwgZXZlbnQubWVzc2FnZS5uYW1lLCAoc3VjY2VzcywgZGF0YSwgZXJyb3JzKSA9PiB7XG5cdFx0XHRcdFx0XHRzZW5kUmVzcG9uc2Uoe1xuXHRcdFx0XHRcdFx0XHRzdWNjZXNzOiBzdWNjZXNzLFxuXHRcdFx0XHRcdFx0XHRkYXRhOiBkYXRhLFxuXHRcdFx0XHRcdFx0XHRlcnJvcnM6IGVycm9yc1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFwiZGVsZXRlXCI6XG5cdFx0XHRcdGlmKCFkb3dubG9hZFN0YXRpb24pXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRzZW5kUmVzcG9uc2Uoe1xuXHRcdFx0XHRcdFx0c3VjY2VzczogZmFsc2UsXG5cdFx0XHRcdFx0XHRkYXRhOiBcImNvdWxkTm90Q29ubmVjdFwiXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZVxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0ZG93bmxvYWRTdGF0aW9uLmZpbGVTdGF0aW9uLmZpbGVTdGF0aW9uRGVsZXRlKGV2ZW50Lm1lc3NhZ2UucGF0aCwgKHN1Y2Nlc3MsIGRhdGEsIGVycm9ycykgPT4ge1xuXHRcdFx0XHRcdFx0c2VuZFJlc3BvbnNlKHtcblx0XHRcdFx0XHRcdFx0c3VjY2Vzczogc3VjY2Vzcyxcblx0XHRcdFx0XHRcdFx0ZGF0YTogZGF0YSxcblx0XHRcdFx0XHRcdFx0ZXJyb3JzOiBlcnJvcnNcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcImdldFN1cHBvcnRlZEZlYXR1cmVzXCI6XG4gICAgICAgICAgICAgICAgaWYoIWRvd25sb2FkU3RhdGlvbilcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHNlbmRSZXNwb25zZShudWxsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIFxuXHRcdFx0XHRcdGRvd25sb2FkU3RhdGlvbi5nZXRTdXBwb3J0ZWRGZWF0dXJlcygoZmVhdHVyZXMpID0+IHtcblx0XHRcdFx0XHRcdHNlbmRSZXNwb25zZShmZWF0dXJlcyk7XG5cdFx0XHRcdFx0fSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXHRcdH1cblx0fSk7XG5cdFxuXHRleHRlbnNpb24uc3RvcmFnZS5hZGRFdmVudExpc3RlbmVyKChjaGFuZ2VzKSA9PiB7XG5cdFx0dmFyIGNoYW5nZWRJdGVtcyA9IE9iamVjdC5rZXlzKGNoYW5nZXMpO1xuXHRcdGlmKGNoYW5nZWRJdGVtcy5pbmRleE9mKFwicXVpY2tDb25uZWN0SWRcIikgIT0gLTEgfHxcblx0XHRcdFx0Y2hhbmdlZEl0ZW1zLmluZGV4T2YoXCJ1c2VybmFtZVwiKSAhPSAtMSB8fCBjaGFuZ2VkSXRlbXMuaW5kZXhPZihcInBhc3N3b3JkXCIpICE9IC0xIHx8XG5cdFx0XHRcdGNoYW5nZWRJdGVtcy5pbmRleE9mKFwicHJvdG9jb2xcIikgIT0gLTEgfHwgY2hhbmdlZEl0ZW1zLmluZGV4T2YoXCJ1cmxcIikgIT0gLTEgfHxcblx0XHRcdFx0Y2hhbmdlZEl0ZW1zLmluZGV4T2YoXCJwb3J0XCIpICE9IC0xKVxuXHRcdHtcblx0XHRcdGluaXQoKTtcblx0XHR9XG5cdFx0ZWxzZSBpZihkb3dubG9hZFN0YXRpb24gIT0gbnVsbCAmJiAoY2hhbmdlZEl0ZW1zLmluZGV4T2YoXCJiYWNrZ3JvdW5kVXBkYXRlSW50ZXJ2YWxcIikgIT0gLTEgfHwgY2hhbmdlZEl0ZW1zLmluZGV4T2YoXCJ1cGRhdGVJbkJhY2tncm91bmRcIikgIT0gLTEpKVxuXHRcdHtcblx0XHRcdGV4dGVuc2lvbi5zdG9yYWdlLmdldChbXCJiYWNrZ3JvdW5kVXBkYXRlSW50ZXJ2YWxcIiwgXCJ1cGRhdGVJbkJhY2tncm91bmRcIl0sIChzdG9yYWdlSXRlbXMpID0+IHtcblx0XHRcdFx0ZG93bmxvYWRTdGF0aW9uLnNldEJhY2tncm91bmRVcGRhdGUoc3RvcmFnZUl0ZW1zW1widXBkYXRlSW5CYWNrZ3JvdW5kXCJdLCBzdG9yYWdlSXRlbXNbXCJiYWNrZ3JvdW5kVXBkYXRlSW50ZXJ2YWxcIl0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9KTtcbn1cblxuXG5mdW5jdGlvbiBpbml0KCkge1xuXHQvLyBEaXNjb25uZWN0IGZyb20gRFMgd2l0aCBvbGQgc2V0dGluZ3Ncblx0aWYoZG93bmxvYWRTdGF0aW9uICE9IG51bGwpIHtcblx0XHRkb3dubG9hZFN0YXRpb24uZGVzdHJveShmdW5jdGlvbigpIHtcblx0XHRcdGRvd25sb2FkU3RhdGlvbiA9IG51bGw7XG5cdFx0XHRpbml0KCk7XG5cdFx0fSk7XG5cdFx0cmV0dXJuO1xuXHR9XG5cdFxuXHRnZXRFeHRlbnNpb25TZXR0aW5ncygoc2V0dGluZ3MpID0+IHtcblx0XHRcblx0XHRpZihzZXR0aW5ncy51c2VybmFtZVx0IT09IG51bGwgJiZcblx0XHRcdHNldHRpbmdzLnBhc3N3b3JkXHQhPT0gbnVsbCAmJlxuXHRcdFx0KHNldHRpbmdzLnF1aWNrQ29ubmVjdElkIHx8IChzZXR0aW5ncy5wcm90b2NvbCAmJiBzZXR0aW5ncy51cmwgJiYgc2V0dGluZ3MucG9ydCkpKVxuXHRcdHtcblx0XHRcdCQuZWFjaChleHRlbnNpb24uZ2V0UG9wb3ZlcnMoKSwgKGluZGV4LCBwb3BvdmVyKSA9PiB7XG5cdFx0XHRcdHRyeXtcblx0XHRcdFx0XHRpZigoPGFueT5wb3BvdmVyKS51cGRhdGVEZXZpY2VJbmZvKSB7XG5cdFx0XHRcdFx0XHQoPGFueT5wb3BvdmVyKS51cGRhdGVEZXZpY2VJbmZvKGdldERldmljZUluZm8oKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblx0XHRcdFx0fSBjYXRjaChleGNlcHRpb24pe1xuXHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoZXhjZXB0aW9uKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRcblx0XHRcdGRvd25sb2FkU3RhdGlvbiA9IG5ldyBEb3dubG9hZFN0YXRpb25BUEkoc2V0dGluZ3MpO1xuXHRcdFx0XG5cdFx0XHRcblx0XHRcdHZhciBjb25uZWN0aW9uVHlwZSA9IHNldHRpbmdzLnF1aWNrQ29ubmVjdElkID8gXCJRdWlja0Nvbm5lY3RcIiA6IFwiTWFudWFsXCI7XG5cdFx0XHRfZ2FxLnB1c2goXG5cdFx0XHRcdFsnX3RyYWNrRXZlbnQnLCAnRGlza1N0YXRpb24nLCAnQ29ubmVjdGlvbiB0eXBlJywgY29ubmVjdGlvblR5cGVdLFxuXHRcdFx0XHRbJ190cmFja0V2ZW50JywgJ0Rpc2tTdGF0aW9uJywgJ1Byb3RvY29sJywgc2V0dGluZ3MucHJvdG9jb2xdLFxuXHRcdFx0XHRbJ190cmFja0V2ZW50JywgJ0Rpc2tTdGF0aW9uJywgJ1VwZGF0ZSBpbnRlcnZhbCcsIHNldHRpbmdzLmJhY2tncm91bmRVcGRhdGVJbnRlcnZhbF0sXG5cdFx0XHRcdFsnX3RyYWNrRXZlbnQnLCAnRGlza1N0YXRpb24nLCAnSGlkZSBzZWVkaW5nIHRvcnJlbnRzJywgc2V0dGluZ3MuaGlkZVNlZWRpbmdUb3JyZW50c11cblx0XHRcdCk7XG5cdFx0XHRcblx0XHRcdGRvd25sb2FkU3RhdGlvbi5hZGRFdmVudExpc3RlbmVyKFwiZGV2aWNlSW5mb1VwZGF0ZWRcIiwgKCkgPT4ge1xuXHRcdFx0XHRfZ2FxLnB1c2goXG5cdFx0XHRcdFx0WydfdHJhY2tFdmVudCcsICdEaXNrU3RhdGlvbicsICdEUyBidWlsZCcsIGRvd25sb2FkU3RhdGlvbi5fdmVyc2lvbl0sXG5cdFx0XHRcdFx0WydfdHJhY2tFdmVudCcsICdEaXNrU3RhdGlvbicsICdEUyB2ZXJzaW9uJywgZG93bmxvYWRTdGF0aW9uLl92ZXJzaW9uU3RyaW5nXSxcblx0XHRcdFx0XHRbJ190cmFja0V2ZW50JywgJ0Rpc2tTdGF0aW9uJywgJ0RTTSB2ZXJzaW9uJywgZG93bmxvYWRTdGF0aW9uLmRldmljZUluZm8uZHNtVmVyc2lvblN0cmluZ10sXG5cdFx0XHRcdFx0WydfdHJhY2tFdmVudCcsICdEaXNrU3RhdGlvbicsICdEU00gYnVpbGQnLCBkb3dubG9hZFN0YXRpb24uZGV2aWNlSW5mby5kc21WZXJzaW9uXSxcblx0XHRcdFx0XHRbJ190cmFja0V2ZW50JywgJ0Rpc2tTdGF0aW9uJywgJ01vZGVsJywgZG93bmxvYWRTdGF0aW9uLmRldmljZUluZm8ubW9kZWxOYW1lXVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHRcblx0XHRcdC8vICFQb3BvdmVyIGxvZ2luIHN0YXR1c1xuXHRcdFx0ZG93bmxvYWRTdGF0aW9uLmFkZEV2ZW50TGlzdGVuZXIoW1wibG9naW5TdGF0dXNDaGFuZ2VcIiwgXCJkZXZpY2VJbmZvVXBkYXRlZFwiLCBcImNvbm5lY3Rpb25TdGF0dXNVcGRhdGVkXCJdLCAoKSA9PiB7XG5cdFx0XHRcdHZhciBwb3BvdmVycyA9IGV4dGVuc2lvbi5nZXRQb3BvdmVycygpO1xuXHRcdFx0XHQkLmVhY2gocG9wb3ZlcnMsIGZ1bmN0aW9uKGluZGV4LCBwb3BvdmVyKSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdCg8YW55PnBvcG92ZXIpLnVwZGF0ZURldmljZUluZm8oZG93bmxvYWRTdGF0aW9uLmRldmljZUluZm8pO1xuXHRcdFx0XHRcdH0gY2F0Y2goZXhjZXB0aW9uKXtcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKGV4Y2VwdGlvbik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFx0XG5cdFx0XHQvLyAhUG9wb3ZlciB0YXNrIGxpc3Rcblx0XHRcdGRvd25sb2FkU3RhdGlvbi5hZGRFdmVudExpc3RlbmVyKFwidGFza3NVcGRhdGVkXCIsICgpID0+IHtcblx0XHRcdFx0dmFyIHBvcG92ZXJzID0gZXh0ZW5zaW9uLmdldFBvcG92ZXJzKCk7XG5cdFx0XHRcdCQuZWFjaChwb3BvdmVycywgZnVuY3Rpb24oaW5kZXgsIHBvcG92ZXIpIHtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0KDxhbnk+cG9wb3ZlcikudXBkYXRlVGFza3MoZG93bmxvYWRTdGF0aW9uLnRhc2tzKTtcblx0XHRcdFx0XHR9IGNhdGNoKGV4Y2VwdGlvbil7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZyhleGNlcHRpb24pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHRcdFxuXHRcdFx0Ly8gIUJhZGdlXG5cdFx0XHRkb3dubG9hZFN0YXRpb24uYWRkRXZlbnRMaXN0ZW5lcihcInRhc2tzVXBkYXRlZFwiLCAoKSA9PiB7XG5cdFx0XHRcdFx0dmFyIGJhZGdlVGV4dCA9IDA7XG5cdFx0XHRcdFx0aWYoZG93bmxvYWRTdGF0aW9uICYmIGRvd25sb2FkU3RhdGlvbi5jb25uZWN0ZWQgPT0gdHJ1ZSAmJiBkb3dubG9hZFN0YXRpb24udGFza3MubGVuZ3RoID4gMClcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR2YXIgZmluaXNoZWRUYXNrcyA9IGRvd25sb2FkU3RhdGlvbi5nZXRGaW5pc2hlZFRhc2tzKCk7XG5cdFx0XHRcdFx0XHRiYWRnZVRleHQgPSBmaW5pc2hlZFRhc2tzLmxlbmd0aDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZXh0ZW5zaW9uLnNldEJhZGdlKGJhZGdlVGV4dCk7XG5cdFx0XHR9KTtcblx0XHRcdFxuXHRcdFx0Ly8gIU5vdGlmaWNhdGlvbnNcblx0XHRcdGRvd25sb2FkU3RhdGlvbi5hZGRFdmVudExpc3RlbmVyKFwidGFza3NVcGRhdGVkXCIsICgpID0+IHtcblx0XHRcdFx0aWYoIWRvd25sb2FkU3RhdGlvbi5fc2V0dGluZ3MudXBkYXRlSW5CYWNrZ3JvdW5kKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHZhciBmaW5pc2hlZFRhc2tzID0gZG93bmxvYWRTdGF0aW9uLmdldEZpbmlzaGVkVGFza3MoKTtcblx0XHRcdFx0aWYoZmluaXNoZWRUYXNrcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0c2hvd0ZpbmlzaGVkVGFza05vdGlmaWNhdGlvbnMoZmluaXNoZWRUYXNrcyk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0XG5cdFx0XHQvLyAhVG9vbGJhciBpY29uXG5cdFx0XHRkb3dubG9hZFN0YXRpb24uYWRkRXZlbnRMaXN0ZW5lcihbXCJjb25uZWN0ZWRcIiwgXCJjb25uZWN0aW9uTG9zdFwiLCBcImxvZ2luU3RhdHVzQ2hhbmdlXCJdLCAoKSA9PiB7XG5cdFx0XHRcdHVwZGF0ZVRvb2xiYXJJY29uKGRvd25sb2FkU3RhdGlvbik7XG5cdFx0XHR9KTtcblx0XHRcdFxuXHRcdFx0XG5cdFx0XHR2YXIgY29udGV4dE1lbnVJdGVtSUQgPSBcImRzQ29udGV4dE1lbnVJdGVtXCI7XG5cdFx0XHR2YXIgY29udGV4dE1lbnVJdGVtSURBZHZhbmNlZCA9IFwiZHNDb250ZXh0TWVudUl0ZW1BZHZhbmNlZFwiO1xuXHRcdFx0dmFyIGNvbnRleHRNZW51SXRlbVRleHQgPSBleHRlbnNpb24uZ2V0TG9jYWxpemVkU3RyaW5nKFwiY29udGV4dE1lbnVEb3dubG9hZE9uXCIsIFtkb3dubG9hZFN0YXRpb24uZGV2aWNlSW5mby5kZXZpY2VOYW1lXSk7XG5cdFx0XHRleHRlbnNpb24uY3JlYXRlQ29udGV4dE1lbnVJdGVtKHtcblx0XHRcdFx0aWQ6IGNvbnRleHRNZW51SXRlbUlELFxuXHRcdFx0XHR0aXRsZTogY29udGV4dE1lbnVJdGVtVGV4dCxcblx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0Y29udGV4dHM6IFtcInNlbGVjdGlvblwiLCBcImxpbmtcIiwgXCJpbWFnZVwiLCBcInZpZGVvXCIsIFwiYXVkaW9cIl0sXG5cdFx0XHRcdG9uY2xpY2s6IGZ1bmN0aW9uKGluZm8sIHRhYil7XG5cdFx0XHRcdFx0dmFyIHVybDogc3RyaW5nID0gbnVsbDtcblx0XHRcdFx0XHR2YXIgaXRlbVR5cGUgPSBcIk5vbmVcIjtcblx0XHRcdFx0XHRpZihpbmZvLmxpbmtVcmwpIHtcblx0XHRcdFx0XHRcdHVybCA9IHN0cmluZ1JlcGxhY2VBbGwoaW5mby5saW5rVXJsLCBcIiBcIiwgXCIlMjBcIik7XG5cdFx0XHRcdFx0XHRpdGVtVHlwZSA9IFwiTGlua1wiO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIGlmKGluZm8uc3JjVXJsKSB7XG5cdFx0XHRcdFx0XHR1cmwgPSBzdHJpbmdSZXBsYWNlQWxsKGluZm8uc3JjVXJsLCBcIiBcIiwgXCIlMjBcIik7XG5cdFx0XHRcdFx0XHRpdGVtVHlwZSA9IFwiU291cmNlICh2aWRlby9hdWRpby9pbWFnZSlcIjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSBpZihpbmZvLnNlbGVjdGlvblRleHQpIHtcblx0XHRcdFx0XHRcdHVybCA9IGluZm8uc2VsZWN0aW9uVGV4dDtcblx0XHRcdFx0XHRcdGl0ZW1UeXBlID0gXCJTZWxlY3Rpb25cIjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0X2dhcS5wdXNoKFsnX3RyYWNrRXZlbnQnLCAnQnV0dG9uJywgJ0NvbnRleHRNZW51JywgaXRlbVR5cGVdKTtcblx0XHRcdFx0XHRcdFxuXHRcdFx0XHRcdGNyZWF0ZVRhc2tXaXRoSHVkKHVybCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHR9KTtcblx0XHRcdFxuXHRcdFx0ZXh0ZW5zaW9uLmNyZWF0ZUNvbnRleHRNZW51SXRlbSh7XG5cdFx0XHRcdGlkOiBjb250ZXh0TWVudUl0ZW1JREFkdmFuY2VkLFxuXHRcdFx0XHR0aXRsZTogZXh0ZW5zaW9uLmdldExvY2FsaXplZFN0cmluZyhcImNvbnRleHRNZW51RG93bmxvYWRBZHZhbmNlZFwiKSxcblx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0Y29udGV4dHM6IFtcInNlbGVjdGlvblwiLCBcImxpbmtcIiwgXCJpbWFnZVwiLCBcInZpZGVvXCIsIFwiYXVkaW9cIl0sXG5cdFx0XHRcdG9uY2xpY2s6IGZ1bmN0aW9uKGluZm8sIHRhYil7XG5cdFx0XHRcdFx0dmFyIHVybDogc3RyaW5nID0gbnVsbDtcblx0XHRcdFx0XHR2YXIgaXRlbVR5cGUgPSBcIk5vbmVcIjtcblx0XHRcdFx0XHRpZihpbmZvLmxpbmtVcmwpIHtcblx0XHRcdFx0XHRcdHVybCA9IHN0cmluZ1JlcGxhY2VBbGwoaW5mby5saW5rVXJsLCBcIiBcIiwgXCIlMjBcIik7XG5cdFx0XHRcdFx0XHRpdGVtVHlwZSA9IFwiTGlua1wiO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIGlmKGluZm8uc3JjVXJsKSB7XG5cdFx0XHRcdFx0XHR1cmwgPSBzdHJpbmdSZXBsYWNlQWxsKGluZm8uc3JjVXJsLCBcIiBcIiwgXCIlMjBcIik7XG5cdFx0XHRcdFx0XHRpdGVtVHlwZSA9IFwiU291cmNlICh2aWRlby9hdWRpby9pbWFnZSlcIjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSBpZihpbmZvLnNlbGVjdGlvblRleHQpIHtcblx0XHRcdFx0XHRcdHVybCA9IGluZm8uc2VsZWN0aW9uVGV4dDtcblx0XHRcdFx0XHRcdGl0ZW1UeXBlID0gXCJTZWxlY3Rpb25cIjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0X2dhcS5wdXNoKFsnX3RyYWNrRXZlbnQnLCAnQnV0dG9uJywgJ0NvbnRleHRNZW51QWR2YW5jZWQnLCBpdGVtVHlwZV0pO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdGV4dGVuc2lvbi5zZW5kTWVzc2FnZVRvQ29udGVudChcIm9wZW5Eb3dubG9hZERpYWxvZ1wiLCB7IHVybDogdXJsIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdFxuXHRcdFx0fSk7XG5cdFx0XHRcblx0XHRcdGRvd25sb2FkU3RhdGlvbi5hZGRFdmVudExpc3RlbmVyKFwiZGVzdHJveVwiLCAoKSA9PiB7XG5cdFx0XHRcdGV4dGVuc2lvbi5yZW1vdmVDb250ZXh0TWVudUl0ZW0oY29udGV4dE1lbnVJdGVtSUQpO1xuXHRcdFx0XHRleHRlbnNpb24ucmVtb3ZlQ29udGV4dE1lbnVJdGVtKGNvbnRleHRNZW51SXRlbUlEQWR2YW5jZWQpO1xuXHRcdFx0fSk7XG5cdFx0XHRcblx0XHRcdGRvd25sb2FkU3RhdGlvbi5zdGFydEJhY2tncm91bmRVcGRhdGUoKTtcblx0XHR9XG5cdH0pO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVUb29sYmFySWNvbihkb3dubG9hZFN0YXRpb246IERvd25sb2FkU3RhdGlvbikge1xuXHRpZiAoZG93bmxvYWRTdGF0aW9uICYmIGRvd25sb2FkU3RhdGlvbi5kZXZpY2VJbmZvICYmIGRvd25sb2FkU3RhdGlvbi5kZXZpY2VJbmZvLmxvZ2dlZEluICYmIGRvd25sb2FkU3RhdGlvbi5jb25uZWN0ZWQpXG5cdHtcblx0XHRpZiAoSVNfQ0hST01FKVxuXHRcdFx0Y2hyb21lLmJyb3dzZXJBY3Rpb24uc2V0SWNvbih7IHBhdGg6IHsgJzE5JyA6ICdJY29uLTE5LnBuZycsICczOCcgOiAnSWNvbi0zOC5wbmcnIH19KTtcblx0XHRlbHNlIGlmIChJU19TQUZBUkkpXG5cdFx0e1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBzYWZhcmkuZXh0ZW5zaW9uLnRvb2xiYXJJdGVtcy5sZW5ndGg7IGkrKylcblx0XHRcdHtcblx0XHRcdFx0c2FmYXJpLmV4dGVuc2lvbi50b29sYmFySXRlbXNbaV0uaW1hZ2UgPSBleHRlbnNpb24uZ2V0UmVzb3VyY2VVUkwoXCJjc3MvaW1nL2ljb24tYmxhY2sucG5nXCIpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRlbHNlXG5cdHtcblx0XHRpZiAoSVNfQ0hST01FKVxuXHRcdFx0Y2hyb21lLmJyb3dzZXJBY3Rpb24uc2V0SWNvbih7IHBhdGg6IHsgJzE5JyA6ICdJY29uLTE5LWRpc2Nvbm5lY3RlZC5wbmcnLCAnMzgnIDogJ0ljb24tMzgtZGlzY29ubmVjdGVkLnBuZycgfX0pO1xuXHRcdGVsc2UgaWYgKElTX1NBRkFSSSlcblx0XHR7XG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHNhZmFyaS5leHRlbnNpb24udG9vbGJhckl0ZW1zLmxlbmd0aDsgaSsrKVxuXHRcdFx0e1xuXHRcdFx0XHRzYWZhcmkuZXh0ZW5zaW9uLnRvb2xiYXJJdGVtc1tpXS5pbWFnZSA9IGV4dGVuc2lvbi5nZXRSZXNvdXJjZVVSTChcImNzcy9pbWcvaWNvbi1ibGFjay1kaXNjb25uZWN0ZWQucG5nXCIpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5mdW5jdGlvbiBzaG93RmluaXNoZWRUYXNrTm90aWZpY2F0aW9ucyhmaW5pc2hlZFRhc2tzOiBBcnJheTxJRG93bmxvYWRTdGF0aW9uVGFzaz4pIHtcblx0ZXh0ZW5zaW9uLnN0b3JhZ2UuZ2V0KFwibm90aWZpZWRUYXNrc1wiLCAoc3RvcmFnZUl0ZW1zOiB7IFtrZXk6IHN0cmluZ10gOiBhbnl9KSA9PiB7XG5cdFx0dmFyIHRvTm90aWZ5ID0gbmV3IEFycmF5PElEb3dubG9hZFN0YXRpb25UYXNrPigpO1xuXHRcdHZhciBub3RpZmllZCA9IHN0b3JhZ2VJdGVtc1tcIm5vdGlmaWVkVGFza3NcIl07XG5cdFx0aWYoIUFycmF5LmlzQXJyYXkobm90aWZpZWQpKVxuXHRcdFx0bm90aWZpZWQgPSBuZXcgQXJyYXkoKTtcblx0XHRcblx0XHQvLyBSZW1vdmUgdGFza3MgZnJvbSBsaXN0IGZvciB3aGljaCBhIG5vdGlmaWNhdGlvbiBoYXMgYmVlbiBzZW50IGJlZm9yZVxuXHRcdCQuZWFjaChmaW5pc2hlZFRhc2tzLCAoaW5kZXg6IG51bWJlciwgdGFzazogSURvd25sb2FkU3RhdGlvblRhc2spID0+IHtcblx0XHRcdGlmKG5vdGlmaWVkLmluZGV4T2YodGFzay5pZCkgPT0gLTEpIHtcblx0XHRcdFx0dG9Ob3RpZnkucHVzaCh0YXNrKTtcblx0XHRcdFx0bm90aWZpZWQucHVzaCh0YXNrLmlkKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRcblx0XHRleHRlbnNpb24uc3RvcmFnZS5zZXQoeyBub3RpZmllZFRhc2tzOiBub3RpZmllZCB9KTtcblx0XHRcblx0XHRpZih0b05vdGlmeS5sZW5ndGggPT0gMSkge1xuXHRcdFx0ZXh0ZW5zaW9uLnNob3dOb3RpZmljYXRpb24oZXh0ZW5zaW9uLmdldExvY2FsaXplZFN0cmluZygnZG93bmxvYWRGaW5pc2hlZCcpLCB0b05vdGlmeVswXS50aXRsZSk7XG5cdFx0fVxuXHRcdFxuXHRcdGVsc2UgaWYodG9Ob3RpZnkubGVuZ3RoID4gMSkge1xuXHRcdFx0dmFyIG1lc3NhZ2UgPSBleHRlbnNpb24uZ2V0TG9jYWxpemVkU3RyaW5nKCdudW1iZXJUYXNrc0ZpbmlzaGVkJywgW3RvTm90aWZ5Lmxlbmd0aC50b1N0cmluZygpXSk7XG5cdFx0XHRleHRlbnNpb24uc2hvd05vdGlmaWNhdGlvbihleHRlbnNpb24uZ2V0TG9jYWxpemVkU3RyaW5nKCdkb3dubG9hZHNGaW5pc2hlZCcpLCBtZXNzYWdlKTtcblx0XHR9XG5cdH0pO1xufVxuXG5mdW5jdGlvbiBnZXRFeHRlbnNpb25TZXR0aW5ncyhjYWxsYmFjazogKHNldHRpbmdzOiBJRXh0ZW5zaW9uU2V0dGluZ3MpID0+IHZvaWQpIHtcblx0ZXh0ZW5zaW9uLnN0b3JhZ2UuZ2V0KFtcInF1aWNrQ29ubmVjdElkXCIsIFwicHJvdG9jb2xcIiwgXCJ1cmxcIiwgXCJwb3J0XCIsIFwidXNlcm5hbWVcIiwgXCJwYXNzd29yZFwiLCBcblx0XHRcdFx0XHRcdFx0XHRcdFwiYmFja2dyb3VuZFVwZGF0ZUludGVydmFsXCIsIFwidXBkYXRlSW5CYWNrZ3JvdW5kXCIsIFxuXHRcdFx0XHRcdFx0XHRcdFx0XCJvcGVuUHJvdG9jb2xzXCIsIFwiaGlkZVNlZWRpbmdUb3JyZW50c1wiLCBcImVtYWlsXCJdLFxuXHRcdFx0XHRcdFx0XHRcdFx0KHN0b3JhZ2VJdGVtczogSUV4dGVuc2lvblNldHRpbmdzKSA9PiB7XG5cdFx0aWYoIUFycmF5LmlzQXJyYXkoc3RvcmFnZUl0ZW1zLm9wZW5Qcm90b2NvbHMpKSB7XG5cdFx0XHRzdG9yYWdlSXRlbXMub3BlblByb3RvY29scyA9IG5ldyBBcnJheTxzdHJpbmc+KCk7XG4gICAgICAgIH1cblx0XHRcblx0XHRjYWxsYmFjayhzdG9yYWdlSXRlbXMpO1xuXHR9KTtcbn1cblxuZnVuY3Rpb24gdGVzdENvbm5lY3Rpb24ob3B0aW9uczogSURvd25sb2FkU3RhdGlvblNldHRpbmdzLCBjYWxsYmFjazogKHN1Y2Nlc3M6IGJvb2xlYW4sIG1lc3NhZ2U6IHN0cmluZywgZGV2aWNlSW5mbz86IElTeW5vbG9neURldmljZUluZm8pID0+IHZvaWQpOiB2b2lkIHtcblx0dmFyIHRlc3RPcHRpb25zOiBhbnkgPSB7fTtcblx0JC5leHRlbmQodGVzdE9wdGlvbnMsIG9wdGlvbnMpO1xuXHR0ZXN0T3B0aW9ucy51cGRhdGVJbkJhY2tncm91bmQgPSBmYWxzZTtcblx0XG5cdHZhciBkc0luc3RhbmNlID0gbmV3IERvd25sb2FkU3RhdGlvbkFQSSh0ZXN0T3B0aW9ucyk7XG5cdGRzSW5zdGFuY2UubG9hZFRhc2tzKChzdWNjZXNzOiBib29sZWFuLCBkYXRhOiBhbnkpID0+IHtcblx0XHRpZihzdWNjZXNzID09PSBmYWxzZSkge1xuXHRcdFx0Y2FsbGJhY2soc3VjY2VzcywgZXh0ZW5zaW9uLmdldExvY2FsaXplZFN0cmluZyhcImFwaV9lcnJvcl9cIiArIGRhdGEpKTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRjYWxsYmFjayhzdWNjZXNzLCBleHRlbnNpb24uZ2V0TG9jYWxpemVkU3RyaW5nKFwidGVzdFJlc3VsdFN1Y2Nlc3NcIiksIGRzSW5zdGFuY2UuZGV2aWNlSW5mbyk7XG5cdFx0fVxuXHRcdFxuXHRcdGRzSW5zdGFuY2UuZGVzdHJveSgpO1xuXHRcdGRzSW5zdGFuY2UgPSBudWxsO1xuXHR9KTtcbn1cblxuaW50ZXJmYWNlIEh1ZEl0ZW0ge1xuICAgIGFjdGlvbjogc3RyaW5nO1xuICAgIGljb246IHN0cmluZztcbiAgICB0ZXh0OiBzdHJpbmc7XG4gICAgYXV0b0hpZGU6IGJvb2xlYW47XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUh1ZChodWRJdGVtOiBIdWRJdGVtKSB7XG5cdGV4dGVuc2lvbi5zZW5kTWVzc2FnZVRvQ29udGVudChcImh1ZFwiLCBodWRJdGVtKTtcbn1cblxuZnVuY3Rpb24gZ2V0RGV2aWNlSW5mbygpIHtcblx0cmV0dXJuIGRvd25sb2FkU3RhdGlvbiA/IGRvd25sb2FkU3RhdGlvbi5kZXZpY2VJbmZvIDogbnVsbDtcbn1cblxuZnVuY3Rpb24gZ2V0VGFza3MoKSB7XG5cdGlmKGRvd25sb2FkU3RhdGlvbiA9PSBudWxsKVxuXHRcdHJldHVybiBbXTtcblx0XG5cdHJldHVybiBkb3dubG9hZFN0YXRpb24udGFza3M7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVRhc2sodXJsOiBzdHJpbmcsIHVzZXJuYW1lPzogc3RyaW5nLCBwYXNzd29yZD86IHN0cmluZywgdW56aXBQYXNzd29yZD86IHN0cmluZywgY2FsbGJhY2s/OiAoc3VjY2VzczogYm9vbGVhbiwgZGF0YTogYW55KSA9PiB2b2lkKSB7XG5cdGlmKGRvd25sb2FkU3RhdGlvbiAhPSBudWxsKSB7XG5cdFx0ZG93bmxvYWRTdGF0aW9uLmNyZWF0ZVRhc2sodXJsLCB1c2VybmFtZSwgcGFzc3dvcmQsIHVuemlwUGFzc3dvcmQsIG51bGwsIGNhbGxiYWNrKTtcblx0XHRfZ2FxLnB1c2goWydfdHJhY2tFdmVudCcsICdEb3dubG9hZHMnLCAnQWRkIHRhc2snXSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlVGFza1dpdGhIdWQodXJsOiBzdHJpbmcsIHVzZXJuYW1lPzogc3RyaW5nLCBwYXNzd29yZD86IHN0cmluZywgdW56aXBQYXNzd29yZD86IHN0cmluZywgY2FsbGJhY2s/OiAoc3VjY2VzczogYm9vbGVhbiwgbWVzc2FnZTogc3RyaW5nKSA9PiB2b2lkKSB7XG5cdFxuXHRpZihkb3dubG9hZFN0YXRpb24gIT0gbnVsbCkge1xuXHRcdHVwZGF0ZUh1ZCh7IGFjdGlvbjogXCJzaG93XCIsIGljb246IFwicHJvZ3Jlc3NcIiwgdGV4dDogZXh0ZW5zaW9uLmdldExvY2FsaXplZFN0cmluZyhcImRvd25sb2FkVGFza0FkZGluZ1wiKSwgYXV0b0hpZGU6IGZhbHNlIH0pO1xuXHRcdFxuXHRcdGRvd25sb2FkU3RhdGlvbi5jcmVhdGVUYXNrKHVybCwgdXNlcm5hbWUsIHBhc3N3b3JkLCB1bnppcFBhc3N3b3JkLCBudWxsLCBmdW5jdGlvbihzdWNjZXNzLCBtZXNzYWdlKSB7XG5cdFx0XHRpZihzdWNjZXNzKSB7XG5cdFx0XHRcdHVwZGF0ZUh1ZCh7IGFjdGlvbjogXCJzaG93XCIsIGljb246IFwiY2hlY2tcIiwgdGV4dDogZXh0ZW5zaW9uLmdldExvY2FsaXplZFN0cmluZyhcImRvd25sb2FkVGFza0FjY2VwdGVkXCIpLCBhdXRvSGlkZTogdHJ1ZSB9KTtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHR1cGRhdGVIdWQoeyBhY3Rpb246IFwic2hvd1wiLCBpY29uOiBcImNyb3NzXCIsIHRleHQ6IGV4dGVuc2lvbi5nZXRMb2NhbGl6ZWRTdHJpbmcoXCJhcGlfZXJyb3JfXCIgKyBtZXNzYWdlKSwgYXV0b0hpZGU6IHRydWUgfSk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdGlmKGNhbGxiYWNrKSB7XG5cdFx0XHRcdGNhbGxiYWNrKHN1Y2Nlc3MsIG1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuXHRcdH0pO1xuXHRcdF9nYXEucHVzaChbJ190cmFja0V2ZW50JywgJ0Rvd25sb2FkcycsICdBZGQgdGFzayddKTtcblx0fVxuXHRlbHNlIHtcblx0XHR1cGRhdGVIdWQoeyBhY3Rpb246IFwic2hvd1wiLCBpY29uOiBcImNyb3NzXCIsIHRleHQ6IGV4dGVuc2lvbi5nZXRMb2NhbGl6ZWRTdHJpbmcoXCJhcGlfZXJyb3JfY291bGROb3RDb25uZWN0XCIpLCBhdXRvSGlkZTogdHJ1ZSB9KTtcblx0fVxufVxuXG5mdW5jdGlvbiByZXN1bWVUYXNrKGlkczogQXJyYXk8c3RyaW5nPiwgY2FsbGJhY2s6IChzdWNjZXNzOiBib29sZWFuLCBkYXRhOiBhbnkpID0+IHZvaWQpIHtcblx0aWYoZG93bmxvYWRTdGF0aW9uICE9IG51bGwpIHtcblx0XHRkb3dubG9hZFN0YXRpb24ucmVzdW1lVGFzayhpZHMsIGNhbGxiYWNrKTtcblx0XHRfZ2FxLnB1c2goWydfdHJhY2tFdmVudCcsICdEb3dubG9hZHMnLCAnUmVzdW1lIHRhc2snLCBpZHMubGVuZ3RoXSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gcGF1c2VUYXNrKGlkczogQXJyYXk8c3RyaW5nPiwgY2FsbGJhY2s6IChzdWNjZXNzOiBib29sZWFuLCBkYXRhOiBhbnkpID0+IHZvaWQpIHtcblx0aWYoZG93bmxvYWRTdGF0aW9uICE9IG51bGwpIHtcblx0XHRkb3dubG9hZFN0YXRpb24ucGF1c2VUYXNrKGlkcywgY2FsbGJhY2spO1xuXHRcdF9nYXEucHVzaChbJ190cmFja0V2ZW50JywgJ0Rvd25sb2FkcycsICdQYXVzZSB0YXNrJywgaWRzLmxlbmd0aF0pO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGRlbGV0ZVRhc2soaWRzOiBBcnJheTxzdHJpbmc+LCBjYWxsYmFjazogKHN1Y2Nlc3M6IGJvb2xlYW4sIGRhdGE6IGFueSkgPT4gdm9pZCkge1xuXHRpZihkb3dubG9hZFN0YXRpb24gIT0gbnVsbCkge1xuXHRcdGRvd25sb2FkU3RhdGlvbi5kZWxldGVUYXNrKGlkcywgY2FsbGJhY2spO1xuXHRcdF9nYXEucHVzaChbJ190cmFja0V2ZW50JywgJ0Rvd25sb2FkcycsICdSZW1vdmUgdGFzaycsIGlkcy5sZW5ndGhdKTtcblx0fVxufVxuXG5mdW5jdGlvbiBjbGVhckZpbmlzaGVkVGFza3MoY2FsbGJhY2s6IChzdWNjZXNzOiBib29sZWFuLCBkYXRhOiBhbnkpID0+IHZvaWQpIHtcblx0aWYoZG93bmxvYWRTdGF0aW9uICE9IG51bGwpIHtcblx0XHRkb3dubG9hZFN0YXRpb24uY2xlYXJGaW5pc2hlZFRhc2tzKChzdWNjZXNzLCBkYXRhKSA9PiB7XG5cdFx0XHRpZihzdWNjZXNzKSB7XG5cdFx0XHRcdGV4dGVuc2lvbi5zdG9yYWdlLnNldCh7IG5vdGlmaWVkVGFza3M6IG5ldyBBcnJheTxzdHJpbmc+KCkgfSk7XG4gICAgICAgICAgICB9XG5cdFx0XHRjYWxsYmFjayhzdWNjZXNzLCBkYXRhKTtcblx0XHR9KTtcblx0XHRfZ2FxLnB1c2goWydfdHJhY2tFdmVudCcsICdEb3dubG9hZHMnLCAnQ2xlYXIgcXVldWUnXSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gc2V0VXBkYXRlSW50ZXJ2YWwoc2Vjb25kczogbnVtYmVyKSB7XG5cdGlmKGRvd25sb2FkU3RhdGlvbiAhPSBudWxsKSB7XG5cdFx0ZG93bmxvYWRTdGF0aW9uLnN0YXJ0QmFja2dyb3VuZFVwZGF0ZShzZWNvbmRzKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGNoZWNrRG9uYXRpb25Ob3RpZmljYXRpb24oKSB7XG5cdHZhciBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblx0dmFyIG9uZVdlZWsgPSA2MDQ4MDAwMDA7XG5cdFxuXHRleHRlbnNpb24uc3RvcmFnZS5nZXQoW1wibGFzdERvbmF0aW9uTm90aWZpY2F0aW9uXCIsIFwiZW1haWxcIl0sIChzdG9yYWdlSXRlbXMpID0+IHtcblx0XHR2YXIgbGFzdENoZWNrOiBudW1iZXIgPSBzdG9yYWdlSXRlbXNbXCJsYXN0RG9uYXRpb25Ob3RpZmljYXRpb25cIl07XG5cdFx0dmFyIGVtYWlsOiBzdHJpbmcgPSBzdG9yYWdlSXRlbXNbXCJlbWFpbFwiXTtcblx0XHRcbiAgICAgICAgaWYobGFzdENoZWNrID09IG51bGwpIHtcblx0XHRcdGxhc3RDaGVjayA9IG5vdyAtIChvbmVXZWVrICogMyk7Ly8gRmlyc3Qgbm90aWZpY2F0aW9uIGFmdGVyIG9uZSB3ZWVrLlxuICAgICAgICB9XG5cdFx0XG5cdFx0aWYoKG5vdy1sYXN0Q2hlY2spID4gb25lV2Vlayo0KSB7XG5cdFx0XHRpZih0eXBlb2YgZW1haWwgIT09IFwic3RyaW5nXCIgfHwgZW1haWwubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdGV4dGVuc2lvbi5zdG9yYWdlLnNldCh7IGxhc3REb25hdGlvbk5vdGlmaWNhdGlvbjogbmV3IERhdGUoKS5nZXRUaW1lKCl9KTtcblx0XHRcdFx0c2hvd0RvbmF0aW9uTm90aWZpY2F0aW9uKCk7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0JC5wb3N0KERPTkFUSU9OX0NIRUNLX1VSTCwgeyBlbWFpbDogZW1haWwgfSlcblx0XHRcdFx0LmRvbmUoKGRhdGEpID0+IHtcblx0XHRcdFx0XHRleHRlbnNpb24uc3RvcmFnZS5zZXQoeyBsYXN0RG9uYXRpb25Ob3RpZmljYXRpb246IG5ldyBEYXRlKCkuZ2V0VGltZSgpfSk7XG5cdFx0XHRcdFx0aWYoIWRhdGEucmVzdWx0KSB7XG5cdFx0XHRcdFx0XHRzaG93RG9uYXRpb25Ob3RpZmljYXRpb24oKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pLmZhaWwoKGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93bikgPT4ge1xuXHRcdFx0XHRcdF9nYXEucHVzaChbJ190cmFja0V2ZW50JywgJ0RvbmF0aW9uIGNoZWNrJywgJ0NoZWNrIGZhaWxlZCcsIHRleHRTdGF0dXMgKyAnIC0gJyArIGVycm9yVGhyb3duXSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGV4dGVuc2lvbi5zdG9yYWdlLnNldCh7IGxhc3REb25hdGlvbk5vdGlmaWNhdGlvbjogbGFzdENoZWNrfSk7XG5cdFx0fVxuXHR9KTtcbn1cblxuZnVuY3Rpb24gc2hvd0RvbmF0aW9uTm90aWZpY2F0aW9uKCkge1xuXHR2YXIgbWVkaXVtID0gXCJ1bmtub3duXCI7XG5cdGlmKElTX09QRVJBKVxuXHRcdG1lZGl1bSA9IFwiT3BlcmFcIjtcblx0ZWxzZSBpZihJU19DSFJPTUUpXG5cdFx0bWVkaXVtID0gXCJDaHJvbWVcIjtcblx0ZWxzZSBpZihJU19TQUZBUkkpXG5cdFx0bWVkaXVtID0gXCJTYWZhcmlcIjtcblx0XHRcblx0dmFyIGRvbmF0aW9uUGFnZVVybCA9IERPTkFUSU9OX1VSTCArIFwiP3V0bV9zb3VyY2U9ZXh0ZW5zaW9uJnV0bV9tZWRpdW09XCIgKyBtZWRpdW0gKyBcIiZ1dG1fY2FtcGFpZ249bm90aWZpY2F0aW9uXCI7XG5cdHZhciBub3RpZmljYXRpb24gPSBleHRlbnNpb24uc2hvd05vdGlmaWNhdGlvbignU3lub2xvZ3kgRG93bmxvYWQgU3RhdGlvbicsIGV4dGVuc2lvbi5nZXRMb2NhbGl6ZWRTdHJpbmcoJ2RvbmF0aW9uTm90aWZpY2F0aW9uJyksIHRydWUsIGRvbmF0aW9uUGFnZVVybCk7XG5cdFxuXHRpZihub3RpZmljYXRpb24gPT0gbnVsbCAmJiBJU19PUEVSQSkge1xuXHRcdGV4dGVuc2lvbi5jcmVhdGVUYWIoZG9uYXRpb25QYWdlVXJsKTtcblx0fVxufVxuXG5mdW5jdGlvbiBzdHJpbmdSZXBsYWNlQWxsKHN1YmplY3Q6IHN0cmluZywgc2VhcmNoOiBzdHJpbmcsIHJlcGxhY2U6IHN0cmluZywgaWdub3JlPzogYm9vbGVhbik6IHN0cmluZyB7XG5cdGlmKHR5cGVvZiBzdWJqZWN0ICE9PSBcInN0cmluZ1wiKVxuXHRcdHJldHVybiBzdWJqZWN0O1xuXHRcblx0cmV0dXJuIHN1YmplY3QucmVwbGFjZShuZXcgUmVnRXhwKHNlYXJjaC5yZXBsYWNlKC8oW1xcL1xcLFxcIVxcXFxcXF5cXCRcXHtcXH1cXFtcXF1cXChcXClcXC5cXCpcXCtcXD9cXHxcXDxcXD5cXC1cXCZdKS9nLFwiXFxcXCQmXCIpLChpZ25vcmU/XCJnaVwiOlwiZ1wiKSksKHR5cGVvZihyZXBsYWNlKT09XCJzdHJpbmdcIik/cmVwbGFjZS5yZXBsYWNlKC9cXCQvZyxcIiQkJCRcIik6cmVwbGFjZSk7XG59XG5cbnZhciBfZ2FxOiBBcnJheTxhbnk+ID0gX2dhcSB8fCBbXTtcbl9nYXEucHVzaChbJ19zZXRBY2NvdW50JywgQU5BTFlUSUNTX0lEXSk7XG5fZ2FxLnB1c2goWydfdHJhY2tQYWdldmlldyddKTtcbl9nYXEucHVzaChbJ190cmFja0V2ZW50JywgJ1N0YXJ0dXAnLCAnRXh0ZW5zaW9uVmVyc2lvbicsICcnICsgZXh0ZW5zaW9uLmdldEV4dGVuc2lvblZlcnNpb24oKV0pO1xuXG4oZnVuY3Rpb24oKSB7XG5cdHZhciBnYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuXHRnYS50eXBlID0gJ3RleHQvamF2YXNjcmlwdCc7XG5cdGdhLmFzeW5jID0gdHJ1ZTtcblx0Z2Euc3JjID0gJ2h0dHBzOi8vc3NsLmdvb2dsZS1hbmFseXRpY3MuY29tL2dhLmpzJztcblx0XG5cdHZhciBzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3NjcmlwdCcpWzBdO1xuXHRzLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGdhLCBzKTtcbn0pKCk7Il0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9

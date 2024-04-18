var DownloadStation = (function () {
    function DownloadStation(options) {
        this._sid = null;
        this._interval = null;
        this._disconnectTimeout = null;
        this._isManager = false;
        this._version = null;
        this._versionString = null;
        this._listeners = {};
        this.connected = false;
        this.tasks = new Array();
        this._settings = $.extend({
            quickConnectId: null,
            protocol: 'http',
            url: null,
            port: null,
            username: null,
            password: null,
            backgroundUpdateInterval: 20,
            updateInBackground: false
        }, options);
        this.deviceInfo = {
            status: "notConnected",
            loggedIn: false,
            dsmVersion: null,
            dsmVersionString: null,
            modelName: null,
            deviceName: this._settings.quickConnectId != null ? this._settings.quickConnectId : (this._settings.url != null ? this._settings.url : "DiskStation"),
            fullUrl: (this._settings.protocol != null && this._settings.url != null && this._settings.port != null)
                ? this._settings.protocol + this._settings.url + ":" + this._settings.port : null
        };
        var self = this;
        window.addEventListener("online", function () {
            self.startBackgroundUpdate();
        }, false);
        window.addEventListener("offline", function () {
            if (self.connected) {
                clearTimeout(self._disconnectTimeout);
                self._sid = null;
                self.deviceInfo.loggedIn = false;
                self.tasks = [];
                self.connected = false;
                self.trigger(["connectionLost", "tasksUpdated"]);
            }
            self.stopBackgroundUpdate();
        }, false);
    }
    DownloadStation.prototype._setStatus = function (newStatus) {
        if (newStatus !== this.deviceInfo.status) {
            this.deviceInfo.status = newStatus;
            this.trigger("connectionStatusUpdated");
        }
    };
    DownloadStation.prototype._isTorrentOrNzbUrl = function (url, username, password, callback) {
        url = $.trim(url);
        // Only check for protocol schemes that Chrome extensions can make XHR calls for
        if (url.toLowerCase().substr(0, 7) !== "http://" && url.toLowerCase().substr(0, 8) !== "https://" &&
            url.toLowerCase().substr(0, 6) !== "ftp://") {
            callback(false);
            return;
        }
        if (url.indexOf("http://dl.rutracker.org/forum/dl.php?t=") === 0) {
            callback(true);
            return;
        }
        var xhr = $.ajax({
            url: url,
            username: username,
            password: password,
            timeout: 5000,
            type: "HEAD"
        });
        xhr.done(function () {
            var contentType = xhr.getResponseHeader('Content-Type') || '';
            var contentLength = xhr.getResponseHeader('Content-Length');
            var urlWithoutParameters = url.removeUrlParameters();
            var fileSize = (typeof contentLength === 'number') ? contentLength : 0;
            var isTorrentFile = (contentType.toLowerCase().indexOf('application/x-bittorrent') != -1) || urlWithoutParameters.toLowerCase().substr(-8, 8) == '.torrent';
            var isNzbFile = (contentType.toLowerCase().indexOf('application/x-nzb') != -1) || urlWithoutParameters.toLowerCase().substr(-4, 4) == '.nzb';
            if ((isTorrentFile || isNzbFile) && fileSize < 2480000)
                callback(true);
            else
                callback(false);
        })
            .fail(function () {
            callback(false);
        });
    };
    DownloadStation.prototype._getDsmVersionString = function (number) {
        if (isNaN(number))
            return "unknown version";
        else if (number < 803)
            return "2.0";
        else if (number < 959)
            return "2.1";
        else if (number < 1118)
            return "2.2";
        else if (number < 1285)
            return "2.3";
        else if (number < 1553)
            return "3.0";
        else if (number < 1869)
            return "3.1";
        else if (number < 2166)
            return "3.2";
        else if (number < 2300)
            return "4.0";
        else if (number < 3100)
            return "4.1";
        else if (number < 3700)
            return "4.2";
        else if (number < 4000)
            return "4.3";
        else
            return "5.0 or later";
    };
    DownloadStation.prototype._bytesToString = function (bytes) {
        var KILOBYTE = 1024;
        var MEGABYTE = KILOBYTE * 1024;
        var GIGABYTE = MEGABYTE * 1024;
        var TERABYTE = GIGABYTE * 1024;
        if (isNaN(bytes)) {
            return "0";
        }
        if (bytes < KILOBYTE) {
            return Math.round(bytes * 100) / 100 + ' B';
        }
        else if (bytes < MEGABYTE) {
            return Math.round(bytes / KILOBYTE * 100) / 100 + ' KB';
        }
        else if (bytes < GIGABYTE) {
            return Math.round(bytes / MEGABYTE * 100) / 100 + ' MB';
        }
        else if (bytes < TERABYTE) {
            return Math.round(bytes / GIGABYTE * 100) / 100 + ' GB';
        }
        else {
            return Math.round(bytes / TERABYTE * 100) / 100 + ' TB';
        }
    };
    DownloadStation.prototype._stringToBytes = function (size) {
        var KILOBYTE = 1024;
        var MEGABYTE = KILOBYTE * 1024;
        var GIGABYTE = MEGABYTE * 1024;
        var TERABYTE = GIGABYTE * 1024;
        var unit = size.substr(-2);
        var factor = 1;
        switch (unit) {
            case "TB":
                factor = TERABYTE;
                break;
            case "GB":
                factor = GIGABYTE;
                break;
            case "MB":
                factor = MEGABYTE;
                break;
            case "KB":
                factor = KILOBYTE;
                break;
        }
        size = size.replace(/[A-Za-z\s]+/g, '');
        var bytes = parseFloat(size) * factor;
        if (isNaN(bytes))
            return 0;
        return Math.round(bytes);
    };
    DownloadStation.prototype.addEventListener = function (type, listener) {
        if (Array.isArray(type)) {
            for (var i = 0; i < type.length; i++) {
                this.addEventListener(type[i], listener);
            }
            return;
        }
        var eventType = type;
        if (typeof this._listeners[eventType] === 'undefined')
            this._listeners[eventType] = [];
        this._listeners[eventType].push(listener);
    };
    DownloadStation.prototype.removeEventListener = function (type, listener) {
        if (Array.isArray(this._listeners[type])) {
            var listeners = this._listeners[type];
            for (var i = 0, len = listeners.length; i < len; i++) {
                if (listeners[i] === listener) {
                    listeners.splice(i, 1);
                    break;
                }
            }
        }
    };
    DownloadStation.prototype.trigger = function (event) {
        if (Array.isArray(event)) {
            for (var i = 0; i < event.length; i++) {
                this.trigger(event[i]);
            }
            return;
        }
        var eventObj = { type: event };
        if (!eventObj.target)
            eventObj.target = this;
        if (!eventObj.type)
            throw new Error("Event object missing 'type' property.");
        if (Array.isArray(this._listeners[eventObj.type])) {
            var listeners = this._listeners[eventObj.type];
            for (var i = 0, len = listeners.length; i < len; i++) {
                listeners[i].call(this, eventObj);
            }
        }
    };
    DownloadStation.prototype.startBackgroundUpdate = function (seconds) {
        var _this = this;
        var self = this;
        // Clear old interval
        this.stopBackgroundUpdate();
        var newInterval = null;
        if (typeof seconds === "number")
            newInterval = seconds;
        else if (this._settings.updateInBackground)
            newInterval = this._settings.backgroundUpdateInterval;
        if (newInterval !== null) {
            var loading = true;
            this._interval = setInterval(function () {
                if (!loading) {
                    _this.loadTasks(function (success, data) {
                        loading = false;
                    });
                }
            }, newInterval * 1000);
            this.loadTasks(function (success, data) {
                loading = false;
            });
        }
    };
    DownloadStation.prototype.stopBackgroundUpdate = function () {
        clearInterval(this._interval);
    };
    DownloadStation.prototype.setBackgroundUpdate = function (updateInBackground, newIntervalSeconds) {
        this._settings.backgroundUpdateInterval = newIntervalSeconds;
        this._settings.updateInBackground = updateInBackground;
        this.stopBackgroundUpdate();
        this.startBackgroundUpdate();
    };
    DownloadStation.prototype.createTask = function (url, username, password, unzipPassword, destinationFolder, callback) {
        var _this = this;
        var urls = this.extractURLs(url);
        var urlTasks = new Array();
        var fileTasks = new Array();
        var typeCheckResultCount = 0;
        $.each(urls, function (i, url) {
            _this._isTorrentOrNzbUrl(url, username, password, function (result) {
                if (result)
                    fileTasks.push(url);
                else
                    urlTasks.push(url);
                typeCheckResultCount++;
                if (typeCheckResultCount < urls.length)
                    return;
                var fileTasksFinished = (fileTasks.length == 0);
                var urlTasksFinished = (urlTasks.length == 0);
                var overallResult = true;
                var createResultHandler = function (success, data) {
                    if (success == false)
                        overallResult = false;
                    if (fileTasksFinished && urlTasksFinished && typeof callback === "function") {
                        callback(overallResult, data);
                    }
                };
                if (urlTasks.length > 0) {
                    _this.createTaskFromUrl(urlTasks, username, password, unzipPassword, destinationFolder, function (success, data) {
                        urlTasksFinished = true;
                        createResultHandler(success, data);
                    });
                }
                if (fileTasks.length > 0) {
                    var fileTasksResult = true;
                    var fileTasksCounter = 0;
                    var fileTaskAddCallback = function (success, data) {
                        fileTasksCounter++;
                        if (success == false)
                            fileTasksResult = false;
                        if (fileTasksCounter == fileTasks.length) {
                            fileTasksFinished = true;
                            createResultHandler(fileTasksResult, data);
                        }
                    };
                    $.each(fileTasks, function (j, fileTask) {
                        _this._downloadFile(fileTask, username, password, function (success, file) {
                            if (success === true)
                                _this.createTaskFromFile(file, unzipPassword, destinationFolder, fileTaskAddCallback);
                            else
                                _this.createTaskFromUrl(url, username, password, unzipPassword, destinationFolder, fileTaskAddCallback);
                        });
                    });
                }
            });
        });
    };
    DownloadStation.prototype._downloadFile = function (url, username, password, callback) {
        var _this = this;
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true, username, password);
            xhr.responseType = 'arraybuffer';
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    var filename = _this._getFilenameFromContentDisposition(xhr.getResponseHeader("Content-Disposition"));
                    if (!filename)
                        filename = url.removeUrlParameters().substring(url.lastIndexOf('/') + 1);
                    var contentType = xhr.getResponseHeader('Content-Type') || "application/octet-stream";
                    var file = new DSFile(filename, contentType, xhr.response, url);
                    if (file.isValidFile()) {
                        callback(true, file);
                    }
                    else {
                        callback(false);
                    }
                }
                else
                    callback(false);
            };
            xhr.onerror = function () {
                callback(false);
            };
            xhr.send();
        }
        catch (exc) {
            callback(false);
        }
    };
    DownloadStation.prototype._getFilenameFromContentDisposition = function (contentDisposition) {
        if (!contentDisposition || contentDisposition.indexOf("filename=") === -1)
            return null;
        var filename = contentDisposition.split('filename=')[1];
        if (filename.indexOf('"') !== -1) {
            filename = filename.split('"')[1];
        }
        else {
            filename = filename.split(" ")[0];
        }
        return filename;
    };
    DownloadStation.prototype.extractURLs = function (text) {
        var patt = new RegExp("(https?|magnet|thunder|flashget|qqdl|s?ftps?|ed2k)(://|:?)\\S+", "ig");
        var urls = new Array();
        do {
            var result = patt.exec(text);
            if (result != null) {
                var url = result[0];
                if (url.charAt(url.length - 1) === ",")
                    url = url.substring(0, url.length - 1);
                urls.push(url);
            }
        } while (result != null);
        if (urls.length > 0)
            return urls;
        else
            return [text];
    };
    DownloadStation.prototype.getFinishedTasks = function () {
        var finishedTasks = new Array();
        for (var i = 0; i < this.tasks.length; i++) {
            var task = this.tasks[i];
            if (task.status == "finished" || (task.sizeDownloaded >= task.size && task.status == "seeding"))
                finishedTasks.push(task);
        }
        return finishedTasks;
    };
    DownloadStation.prototype.destroy = function (callback) {
        var _this = this;
        this.logout(function () {
            _this.connected = false;
            _this.trigger("destroy");
            if (callback) {
                callback();
            }
        });
    };
    return DownloadStation;
}());
var DSFile = (function () {
    function DSFile(filename, mimeType, data, url) {
        this.blob = null;
        this.filename = $.trim(filename);
        this.mimeType = mimeType;
        this.url = url;
        this.data = data;
        // Fix filename
        if (this.mimeType == "application/x-bittorrent" && this.filename.substr(-8, 8).toLowerCase() != ".torrent")
            this.filename = "download.torrent";
        else if (this.mimeType == "application/x-nzb" && this.filename.substr(-4, 4).toLowerCase() != ".nzb")
            this.filename = "download.nzb";
        // Fix mime-type
        if (this.filename.substr(-8, 8).toLowerCase() == '.torrent')
            this.mimeType = "application/x-bittorrent";
        else if (this.filename.substr(-4, 4).toLowerCase() == ".nzb")
            this.mimeType = "application/x-nzb";
    }
    DSFile.prototype.isValidFile = function () {
        if (this.mimeType != "application/x-nzb" && this.mimeType != "application/x-bittorrent"
            && this.filename.substr(-8, 8).toLowerCase() != '.torrent'
            && this.filename.substr(-4, 4).toLowerCase() != ".nzb") {
            return false;
        }
        else if (this.getBlob() == null) {
            return false;
        }
        return true;
    };
    DSFile.prototype.getBlob = function () {
        if (this.blob instanceof Blob === false)
            this.createBlob();
        return this.blob;
    };
    DSFile.prototype.createBlob = function () {
        try {
            this.blob = new Blob([this.data], { type: this.mimeType });
        }
        catch (e) {
            console.log("Blob constructor not supported, falling back to BlobBuilder");
            // Old browsers
            var w = window;
            var blobBuilder = w.BlobBuilder ||
                w.WebKitBlobBuilder ||
                w.MozBlobBuilder ||
                w.MSBlobBuilder;
            if (w.BlobBuilder) {
                try {
                    var bb = new blobBuilder();
                    bb.append(this.data);
                    this.blob = bb.getBlob(this.mimeType);
                }
                catch (bbException) {
                    console.warn("Error in BlobBuilder");
                    console.log(bbException);
                }
            }
            else {
                console.log("BlobBuilder not supported");
            }
        }
    };
    return DSFile;
}());

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImpzL2Rvd25sb2Fkc3RhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUE4Q0E7SUFvQkkseUJBQVksT0FBaUM7UUFsQm5DLFNBQUksR0FBVyxJQUFJLENBQUM7UUFDdEIsY0FBUyxHQUFXLElBQUksQ0FBQztRQUN2Qix1QkFBa0IsR0FBVyxJQUFJLENBQUM7UUFDbEMsZUFBVSxHQUFZLEtBQUssQ0FBQztRQUMvQixhQUFRLEdBQVcsSUFBSSxDQUFDO1FBQ3hCLG1CQUFjLEdBQVcsSUFBSSxDQUFDO1FBQzdCLGVBQVUsR0FBUSxFQUFFLENBQUM7UUFFdEIsY0FBUyxHQUFZLEtBQUssQ0FBQztRQUMzQixVQUFLLEdBQWdDLElBQUksS0FBSyxFQUF3QixDQUFDO1FBVTlFLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQztZQUN0QixjQUFjLEVBQUUsSUFBSTtZQUNwQixRQUFRLEVBQUcsTUFBTTtZQUNqQixHQUFHLEVBQUssSUFBSTtZQUNaLElBQUksRUFBSSxJQUFJO1lBQ1osUUFBUSxFQUFHLElBQUk7WUFDZixRQUFRLEVBQUcsSUFBSTtZQUNmLHdCQUF3QixFQUFHLEVBQUU7WUFDN0Isa0JBQWtCLEVBQUcsS0FBSztTQUM3QixFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBRVosSUFBSSxDQUFDLFVBQVUsR0FBRztZQUNkLE1BQU0sRUFBSyxjQUFjO1lBQ3pCLFFBQVEsRUFBSSxLQUFLO1lBQ2pCLFVBQVUsRUFBSSxJQUFJO1lBQ2xCLGdCQUFnQixFQUFFLElBQUk7WUFDdEIsU0FBUyxFQUFJLElBQUk7WUFDakIsVUFBVSxFQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxhQUFhLENBQUM7WUFDdkosT0FBTyxF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YWRzdGF0aW9uLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW50ZXJmYWNlIElEb3dubG9hZFN0YXRpb25TZXR0aW5ncyB7XG4gICAgcXVpY2tDb25uZWN0SWQ6IHN0cmluZztcbiAgICBwcm90b2NvbDogc3RyaW5nO1xuICAgIHVybDogc3RyaW5nO1xuICAgIHBvcnQ6IG51bWJlcjtcbiAgICB1c2VybmFtZTogc3RyaW5nO1xuICAgIHBhc3N3b3JkOiBzdHJpbmc7XG4gICAgYmFja2dyb3VuZFVwZGF0ZUludGVydmFsOiBudW1iZXI7XG4gICAgdXBkYXRlSW5CYWNrZ3JvdW5kOiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgSURvd25sb2FkU3RhdGlvblRhc2sge1xuICAgIGlkOiBzdHJpbmc7XG4gICAgdHlwZTogc3RyaW5nO1xuICAgIHRpdGxlOiBzdHJpbmc7XG4gICAgc3RhdHVzOiBzdHJpbmc7XG4gICAgZXJyb3JEZXRhaWw6IHN0cmluZztcbiAgICBzaXplOiBudW1iZXI7XG4gICAgc2l6ZVN0cmluZzogc3RyaW5nO1xuICAgIGRvd25sb2FkUHJvZ3Jlc3NTdHJpbmc6IHN0cmluZztcbiAgICB1bnppcFByb2dyZXNzOiBudW1iZXI7XG4gICAgdW56aXBQcm9ncmVzc1N0cmluZzogc3RyaW5nO1xuICAgIHNpemVEb3dubG9hZGVkOiBudW1iZXI7XG4gICAgc2l6ZURvd25sb2FkZWRTdHJpbmc6IHN0cmluZztcbiAgICBzaXplVXBsb2FkZWQ6IG51bWJlcjtcbiAgICBzaXplVXBsb2FkZWRTdHJpbmc6IHN0cmluZztcbiAgICBzcGVlZERvd25sb2FkOiBudW1iZXI7XG4gICAgc3BlZWREb3dubG9hZFN0cmluZzogc3RyaW5nO1xuICAgIHNwZWVkVXBsb2FkOiBudW1iZXI7XG4gICAgc3BlZWRVcGxvYWRTdHJpbmc6IHN0cmluZztcbiAgICB1cGxvYWRSYXRpbz86IG51bWJlcjtcbiAgICB1cGxvYWRSYXRpb1N0cmluZz86IHN0cmluZztcbiAgICBldGE/OiBudW1iZXI7XG4gICAgZXRhU3RyaW5nPzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgSVN5bm9sb2d5RGV2aWNlSW5mbyB7XG4gICAgc3RhdHVzOiBzdHJpbmc7XG4gICAgbG9nZ2VkSW46IGJvb2xlYW47XG4gICAgZHNtVmVyc2lvbjogbnVtYmVyO1xuICAgIGRzbVZlcnNpb25TdHJpbmc6IHN0cmluZztcbiAgICBtb2RlbE5hbWU6IHN0cmluZztcbiAgICBkZXZpY2VOYW1lOiBzdHJpbmc7XG4gICAgZnVsbFVybDogc3RyaW5nO1xufVxuXG5hYnN0cmFjdCBjbGFzcyBEb3dubG9hZFN0YXRpb24ge1xuICAgIHB1YmxpYyBfc2V0dGluZ3M6IElEb3dubG9hZFN0YXRpb25TZXR0aW5ncztcbiAgICBwcm90ZWN0ZWQgX3NpZDogc3RyaW5nID0gbnVsbDtcbiAgICBwcml2YXRlIF9pbnRlcnZhbDogbnVtYmVyID0gbnVsbDtcbiAgICBwcm90ZWN0ZWQgX2Rpc2Nvbm5lY3RUaW1lb3V0OiBudW1iZXIgPSBudWxsO1xuICAgIHByb3RlY3RlZCBfaXNNYW5hZ2VyOiBib29sZWFuID0gZmFsc2U7XG4gICAgcHVibGljIF92ZXJzaW9uOiBudW1iZXIgPSBudWxsO1xuICAgIHB1YmxpYyBfdmVyc2lvblN0cmluZzogc3RyaW5nID0gbnVsbDtcbiAgICBwcml2YXRlIF9saXN0ZW5lcnM6IGFueSA9IHt9O1xuICAgIFxuICAgIHB1YmxpYyBjb25uZWN0ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBwdWJsaWMgdGFza3M6IEFycmF5PElEb3dubG9hZFN0YXRpb25UYXNrPiA9IG5ldyBBcnJheTxJRG93bmxvYWRTdGF0aW9uVGFzaz4oKTtcbiAgICBwdWJsaWMgZGV2aWNlSW5mbzogSVN5bm9sb2d5RGV2aWNlSW5mbztcblxuICAgIHByb3RlY3RlZCBhYnN0cmFjdCBsb2dvdXQoY2FsbGJhY2s6IChzdWNjZXNzOiBib29sZWFuLCBkYXRhOiBhbnkpID0+IHZvaWQpOiB2b2lkO1xuXG4gICAgcHJvdGVjdGVkIGFic3RyYWN0IGxvYWRUYXNrcyhjYWxsYmFjazogKHN1Y2Nlc3M6IGJvb2xlYW4sIGRhdGE6IGFueSkgPT4gdm9pZCk6IHZvaWQ7XG4gICAgcHJvdGVjdGVkIGFic3RyYWN0IGNyZWF0ZVRhc2tGcm9tVXJsKHVybFRhc2tzOiBzdHJpbmd8QXJyYXk8c3RyaW5nPiwgdXNlcm5hbWU6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZywgdW56aXBQYXNzd29yZDogc3RyaW5nLCBkZXN0aW5hdGlvbkZvbGRlcjogc3RyaW5nLCBjYWxsYmFjazogKHN1Y2Nlc3M6IGJvb2xlYW4sIGRhdGE6IGFueSkgPT4gdm9pZCk6IHZvaWQ7XG4gICAgcHJvdGVjdGVkIGFic3RyYWN0IGNyZWF0ZVRhc2tGcm9tRmlsZShmaWxlOiBEU0ZpbGUsIHVuemlwUGFzc3dvcmQ6IHN0cmluZywgZGVzdGluYXRpb25Gb2xkZXI6IHN0cmluZywgZmlsZVRhc2tBZGRDYWxsYmFjazogKHN1Y2Nlc3M6IGJvb2xlYW4sIGRhdGE6IGFueSkgPT4gdm9pZCk6IHZvaWQ7XG4gICAgXG4gICAgY29uc3RydWN0b3Iob3B0aW9uczogSURvd25sb2FkU3RhdGlvblNldHRpbmdzKXtcbiAgICB0aGlzLl9zZXR0aW5ncyA9ICQuZXh0ZW5kKHtcbiAgICAgICAgcXVpY2tDb25uZWN0SWQ6IG51bGwsXG4gICAgICAgIHByb3RvY29sXHQ6ICdodHRwJyxcbiAgICAgICAgdXJsXHRcdFx0OiBudWxsLFxuICAgICAgICBwb3J0XHRcdDogbnVsbCxcbiAgICAgICAgdXNlcm5hbWVcdDogbnVsbCxcbiAgICAgICAgcGFzc3dvcmRcdDogbnVsbCxcbiAgICAgICAgYmFja2dyb3VuZFVwZGF0ZUludGVydmFsIDogMjAsXG4gICAgICAgIHVwZGF0ZUluQmFja2dyb3VuZCA6IGZhbHNlXG4gICAgfSwgb3B0aW9ucyk7XG4gICAgXG4gICAgdGhpcy5kZXZpY2VJbmZvID0ge1xuICAgICAgICBzdGF0dXNcdFx0XHQ6IFwibm90Q29ubmVjdGVkXCIsXG4gICAgICAgIGxvZ2dlZEluXHRcdDogZmFsc2UsXG4gICAgICAgIGRzbVZlcnNpb25cdFx0OiBudWxsLFxuICAgICAgICBkc21WZXJzaW9uU3RyaW5nOiBudWxsLFxuICAgICAgICBtb2RlbE5hbWVcdFx0OiBudWxsLFxuICAgICAgICBkZXZpY2VOYW1lXHRcdDogdGhpcy5fc2V0dGluZ3MucXVpY2tDb25uZWN0SWQgIT0gbnVsbCA/IHRoaXMuX3NldHRpbmdzLnF1aWNrQ29ubmVjdElkIDogKHRoaXMuX3NldHRpbmdzLnVybCAhPSBudWxsID8gdGhpcy5fc2V0dGluZ3MudXJsIDogXCJEaXNrU3RhdGlvblwiKSxcbiAgICAgICAgZnVsbFVybFx0XHRcdDogKHRoaXMuX3NldHRpbmdzLnByb3RvY29sICE9IG51bGwgJiYgdGhpcy5fc2V0dGluZ3MudXJsICE9IG51bGwgJiYgdGhpcy5fc2V0dGluZ3MucG9ydCAhPSBudWxsKVxuICAgICAgICAgICAgICAgICAgICAgICAgPyB0aGlzLl9zZXR0aW5ncy5wcm90b2NvbCArIHRoaXMuX3NldHRpbmdzLnVybCArIFwiOlwiICsgdGhpcy5fc2V0dGluZ3MucG9ydCA6IG51bGxcbiAgICB9O1xuICAgIFxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm9ubGluZVwiLCBmdW5jdGlvbigpIHtcbiAgICAgICAgc2VsZi5zdGFydEJhY2tncm91bmRVcGRhdGUoKTtcbiAgICB9LCBmYWxzZSk7XG4gICAgXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJvZmZsaW5lXCIsIGZ1bmN0aW9uKCkge1xuICAgICAgICBpZihzZWxmLmNvbm5lY3RlZCkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHNlbGYuX2Rpc2Nvbm5lY3RUaW1lb3V0KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgc2VsZi5fc2lkID0gbnVsbDtcbiAgICAgICAgICAgIHNlbGYuZGV2aWNlSW5mby5sb2dnZWRJbiA9IGZhbHNlO1xuICAgICAgICAgICAgc2VsZi50YXNrcyA9IFtdO1xuICAgICAgICAgICAgc2VsZi5jb25uZWN0ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHNlbGYudHJpZ2dlcihbXCJjb25uZWN0aW9uTG9zdFwiLCBcInRhc2tzVXBkYXRlZFwiXSk7XG4gICAgICAgIH1cbiAgICAgICAgc2VsZi5zdG9wQmFja2dyb3VuZFVwZGF0ZSgpO1xuICAgIH0sIGZhbHNlKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBfc2V0U3RhdHVzKG5ld1N0YXR1cz86IHN0cmluZykge1xuICAgICAgaWYgKG5ld1N0YXR1cyAhPT0gdGhpcy5kZXZpY2VJbmZvLnN0YXR1cykge1xuICAgICAgICAgIHRoaXMuZGV2aWNlSW5mby5zdGF0dXMgPSBuZXdTdGF0dXM7XG4gICAgICAgICAgdGhpcy50cmlnZ2VyKFwiY29ubmVjdGlvblN0YXR1c1VwZGF0ZWRcIik7XG4gICAgICB9XG4gIH1cblxuICAgIHByaXZhdGUgX2lzVG9ycmVudE9yTnpiVXJsKHVybDogc3RyaW5nLCB1c2VybmFtZTogc3RyaW5nLCBwYXNzd29yZDogc3RyaW5nLCBjYWxsYmFjazogKHJlc3VsdDogYm9vbGVhbikgPT4gdm9pZCkge1xuICAgICAgICB1cmwgPSAkLnRyaW0odXJsKTtcbiAgICAgICAgXG4gICAgICAgIC8vIE9ubHkgY2hlY2sgZm9yIHByb3RvY29sIHNjaGVtZXMgdGhhdCBDaHJvbWUgZXh0ZW5zaW9ucyBjYW4gbWFrZSBYSFIgY2FsbHMgZm9yXG4gICAgICAgIGlmICh1cmwudG9Mb3dlckNhc2UoKS5zdWJzdHIoMCwgNykgIT09IFwiaHR0cDovL1wiICYmIHVybC50b0xvd2VyQ2FzZSgpLnN1YnN0cigwLCA4KSAhPT0gXCJodHRwczovL1wiICYmXG4gICAgICAgICAgICB1cmwudG9Mb3dlckNhc2UoKS5zdWJzdHIoMCwgNikgIT09IFwiZnRwOi8vXCIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGZhbHNlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKHVybC5pbmRleE9mKFwiaHR0cDovL2RsLnJ1dHJhY2tlci5vcmcvZm9ydW0vZGwucGhwP3Q9XCIpID09PSAwKSB7XG4gICAgICAgICAgICBjYWxsYmFjayh0cnVlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICBcbiAgICAgICAgdmFyIHhociA9ICQuYWpheCh7XG4gICAgICAgICAgICB1cmw6IHVybCxcbiAgICAgICAgICAgIHVzZXJuYW1lOiB1c2VybmFtZSxcbiAgICAgICAgICAgIHBhc3N3b3JkOiBwYXNzd29yZCxcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgICAgICB0eXBlOiBcIkhFQURcIlxuICAgICAgICB9KTtcbiAgICAgICAgeGhyLmRvbmUoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGNvbnRlbnRUeXBlID0geGhyLmdldFJlc3BvbnNlSGVhZGVyKCdDb250ZW50LVR5cGUnKSB8fCAnJztcbiAgICAgICAgICAgIHZhciBjb250ZW50TGVuZ3RoID0geGhyLmdldFJlc3BvbnNlSGVhZGVyKCdDb250ZW50LUxlbmd0aCcpO1xuICAgICAgICAgICAgdmFyIHVybFdpdGhvdXRQYXJhbWV0ZXJzOiBzdHJpbmcgPSAoPGFueT51cmwpLnJlbW92ZVVybFBhcmFtZXRlcnMoKTtcbiAgICBcbiAgICAgICAgICAgIHZhciBmaWxlU2l6ZSA9ICh0eXBlb2YgY29udGVudExlbmd0aCA9PT0gJ251bWJlcicpID8gY29udGVudExlbmd0aCA6IDA7XG4gICAgICAgICAgICB2YXIgaXNUb3JyZW50RmlsZSA9IChjb250ZW50VHlwZS50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2FwcGxpY2F0aW9uL3gtYml0dG9ycmVudCcpICE9IC0xKSB8fCB1cmxXaXRob3V0UGFyYW1ldGVycy50b0xvd2VyQ2FzZSgpLnN1YnN0cigtOCwgOCkgPT0gJy50b3JyZW50JztcbiAgICAgICAgICAgIHZhciBpc056YkZpbGUgPSAoY29udGVudFR5cGUudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdhcHBsaWNhdGlvbi94LW56YicpICE9IC0xKSB8fCB1cmxXaXRob3V0UGFyYW1ldGVycy50b0xvd2VyQ2FzZSgpLnN1YnN0cigtNCwgNCkgPT0gJy5uemInO1xuICAgIFxuICAgICAgICAgICAgaWYgKChpc1RvcnJlbnRGaWxlIHx8IGlzTnpiRmlsZSkgJiYgZmlsZVNpemUgPCAyNDgwMDAwKVxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKHRydWUpO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGZhbHNlKTtcbiAgICAgICAgfSlcbiAgICAgICAgLmZhaWwoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgY2FsbGJhY2soZmFsc2UpO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgcHJvdGVjdGVkIF9nZXREc21WZXJzaW9uU3RyaW5nKG51bWJlcjogbnVtYmVyKSB7XG4gICAgICAgIGlmIChpc05hTihudW1iZXIpKVxuICAgICAgICAgICAgcmV0dXJuIFwidW5rbm93biB2ZXJzaW9uXCI7XG4gICAgICAgIGVsc2UgaWYgKG51bWJlciA8IDgwMylcbiAgICAgICAgICAgIHJldHVybiBcIjIuMFwiO1xuICAgICAgICBlbHNlIGlmIChudW1iZXIgPCA5NTkpXG4gICAgICAgICAgICByZXR1cm4gXCIyLjFcIjtcbiAgICAgICAgZWxzZSBpZiAobnVtYmVyIDwgMTExOClcbiAgICAgICAgICAgIHJldHVybiBcIjIuMlwiO1xuICAgICAgICBlbHNlIGlmIChudW1iZXIgPCAxMjg1KVxuICAgICAgICAgICAgcmV0dXJuIFwiMi4zXCI7XG4gICAgICAgIGVsc2UgaWYgKG51bWJlciA8IDE1NTMpXG4gICAgICAgICAgICByZXR1cm4gXCIzLjBcIjtcbiAgICAgICAgZWxzZSBpZiAobnVtYmVyIDwgMTg2OSlcbiAgICAgICAgICAgIHJldHVybiBcIjMuMVwiO1xuICAgICAgICBlbHNlIGlmIChudW1iZXIgPCAyMTY2KVxuICAgICAgICAgICAgcmV0dXJuIFwiMy4yXCI7XG4gICAgICAgIGVsc2UgaWYgKG51bWJlciA8IDIzMDApXG4gICAgICAgICAgICByZXR1cm4gXCI0LjBcIjtcbiAgICAgICAgZWxzZSBpZiAobnVtYmVyIDwgMzEwMClcbiAgICAgICAgICAgIHJldHVybiBcIjQuMVwiO1xuICAgICAgICBlbHNlIGlmIChudW1iZXIgPCAzNzAwKVxuICAgICAgICAgICAgcmV0dXJuIFwiNC4yXCI7XG4gICAgICAgIGVsc2UgaWYgKG51bWJlciA8IDQwMDApXG4gICAgICAgICAgICByZXR1cm4gXCI0LjNcIjtcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgcmV0dXJuIFwiNS4wIG9yIGxhdGVyXCI7XG4gICAgfVxuICAgIFxuICAgIHByb3RlY3RlZCBfYnl0ZXNUb1N0cmluZyhieXRlczogbnVtYmVyKSB7XG4gICAgICAgIHZhciBLSUxPQllURSA9IDEwMjQ7XG4gICAgICAgIHZhciBNRUdBQllURSA9IEtJTE9CWVRFICogMTAyNDtcbiAgICAgICAgdmFyIEdJR0FCWVRFID0gTUVHQUJZVEUgKiAxMDI0O1xuICAgICAgICB2YXIgVEVSQUJZVEUgPSBHSUdBQllURSAqIDEwMjQ7XG4gICAgXG4gICAgICAgIGlmIChpc05hTihieXRlcykpIHtcbiAgICAgICAgICAgIHJldHVybiBcIjBcIjtcbiAgICAgICAgfSBpZiAoYnl0ZXMgPCBLSUxPQllURSkge1xuICAgICAgICAgICAgcmV0dXJuIE1hdGgucm91bmQoYnl0ZXMgKiAxMDApIC8gMTAwICsgJyBCJztcbiAgICAgICAgfSBlbHNlIGlmIChieXRlcyA8IE1FR0FCWVRFKSB7XG4gICAgICAgICAgICByZXR1cm4gTWF0aC5yb3VuZChieXRlcyAvIEtJTE9CWVRFICogMTAwKSAvIDEwMCArICcgS0InO1xuICAgICAgICB9IGVsc2UgaWYgKGJ5dGVzIDwgR0lHQUJZVEUpIHtcbiAgICAgICAgICAgIHJldHVybiBNYXRoLnJvdW5kKGJ5dGVzIC8gTUVHQUJZVEUgKiAxMDApIC8gMTAwICsgJyBNQic7XG4gICAgICAgIH0gZWxzZSBpZiAoYnl0ZXMgPCBURVJBQllURSkge1xuICAgICAgICAgICAgcmV0dXJuIE1hdGgucm91bmQoYnl0ZXMgLyBHSUdBQllURSAqIDEwMCkgLyAxMDAgKyAnIEdCJztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBNYXRoLnJvdW5kKGJ5dGVzIC8gVEVSQUJZVEUgKiAxMDApIC8gMTAwICsgJyBUQic7XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcHJpdmF0ZSBfc3RyaW5nVG9CeXRlcyhzaXplOiBzdHJpbmcpIHtcbiAgICAgICAgdmFyIEtJTE9CWVRFID0gMTAyNDtcbiAgICAgICAgdmFyIE1FR0FCWVRFID0gS0lMT0JZVEUgKiAxMDI0O1xuICAgICAgICB2YXIgR0lHQUJZVEUgPSBNRUdBQllURSAqIDEwMjQ7XG4gICAgICAgIHZhciBURVJBQllURSA9IEdJR0FCWVRFICogMTAyNDtcbiAgICAgICAgXG4gICAgICAgIHZhciB1bml0ID0gc2l6ZS5zdWJzdHIoLTIpO1xuICAgICAgICB2YXIgZmFjdG9yID0gMTtcbiAgICAgICAgXG4gICAgICAgIHN3aXRjaCAodW5pdCkge1xuICAgICAgICAgICAgY2FzZSBcIlRCXCI6XG4gICAgICAgICAgICBmYWN0b3IgPSBURVJBQllURTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcIkdCXCI6XG4gICAgICAgICAgICBmYWN0b3IgPSBHSUdBQllURTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcIk1CXCI6XG4gICAgICAgICAgICBmYWN0b3IgPSBNRUdBQllURTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcIktCXCI6XG4gICAgICAgICAgICBmYWN0b3IgPSBLSUxPQllURTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBzaXplID0gc2l6ZS5yZXBsYWNlKC9bQS1aYS16XFxzXSsvZywgJycpO1xuICAgICAgICB2YXIgYnl0ZXMgPSBwYXJzZUZsb2F0KHNpemUpICogZmFjdG9yO1xuICAgICAgICBcbiAgICAgICAgaWYoaXNOYU4oYnl0ZXMpKVxuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gTWF0aC5yb3VuZChieXRlcyk7XG4gICAgfVxuICAgIFxuICAgIHB1YmxpYyBhZGRFdmVudExpc3RlbmVyKHR5cGU6IHN0cmluZ3xBcnJheTxzdHJpbmc+LCBsaXN0ZW5lcjogKCkgPT4gdm9pZCkge1xuICAgICAgICBpZihBcnJheS5pc0FycmF5KHR5cGUpKVxuICAgICAgICB7XG4gICAgICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgdHlwZS5sZW5ndGg7IGkrKylcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIodHlwZVtpXSwgbGlzdGVuZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICB2YXIgZXZlbnRUeXBlID0gPHN0cmluZz50eXBlO1xuICAgICAgICBpZiAodHlwZW9mIHRoaXMuX2xpc3RlbmVyc1tldmVudFR5cGVdID09PSAndW5kZWZpbmVkJylcbiAgICAgICAgICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudFR5cGVdID0gW107XG4gICAgXG4gICAgICAgIHRoaXMuX2xpc3RlbmVyc1tldmVudFR5cGVdLnB1c2gobGlzdGVuZXIpO1xuICAgIH1cbiAgICBcbiAgICBwdWJsaWMgcmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlOiBzdHJpbmcsIGxpc3RlbmVyOiAoKSA9PiB2b2lkKSB7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHRoaXMuX2xpc3RlbmVyc1t0eXBlXSkpIHtcbiAgICAgICAgICAgIHZhciBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnNbdHlwZV07XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGxpc3RlbmVyc1tpXSA9PT0gbGlzdGVuZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgbGlzdGVuZXJzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIHB1YmxpYyB0cmlnZ2VyKGV2ZW50OiBhbnkpIHtcbiAgICAgICAgaWYoQXJyYXkuaXNBcnJheShldmVudCkpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBldmVudC5sZW5ndGg7IGkrKylcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnRbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICB2YXIgZXZlbnRPYmo6IGFueSA9IHsgdHlwZTogZXZlbnQgfTtcbiAgICBcbiAgICAgICAgaWYgKCFldmVudE9iai50YXJnZXQpXG4gICAgICAgICAgICBldmVudE9iai50YXJnZXQgPSB0aGlzO1xuICAgIFxuICAgICAgICBpZiAoIWV2ZW50T2JqLnR5cGUpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFdmVudCBvYmplY3QgbWlzc2luZyAndHlwZScgcHJvcGVydHkuXCIpO1xuICAgIFxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh0aGlzLl9saXN0ZW5lcnNbZXZlbnRPYmoudHlwZV0pKSB7XG4gICAgICAgICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzW2V2ZW50T2JqLnR5cGVdO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGxpc3RlbmVyc1tpXS5jYWxsKHRoaXMsIGV2ZW50T2JqKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBzdGFydEJhY2tncm91bmRVcGRhdGUoc2Vjb25kcz86IG51bWJlcikge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIC8vIENsZWFyIG9sZCBpbnRlcnZhbFxuICAgICAgICB0aGlzLnN0b3BCYWNrZ3JvdW5kVXBkYXRlKCk7XG4gICAgXG4gICAgICAgIHZhciBuZXdJbnRlcnZhbDogbnVtYmVyID0gbnVsbDtcbiAgICAgICAgaWYgKHR5cGVvZiBzZWNvbmRzID09PSBcIm51bWJlclwiKVxuICAgICAgICAgICAgbmV3SW50ZXJ2YWwgPSBzZWNvbmRzO1xuICAgICAgICBlbHNlIGlmICh0aGlzLl9zZXR0aW5ncy51cGRhdGVJbkJhY2tncm91bmQpXG4gICAgICAgICAgICBuZXdJbnRlcnZhbCA9IHRoaXMuX3NldHRpbmdzLmJhY2tncm91bmRVcGRhdGVJbnRlcnZhbDtcbiAgICBcbiAgICAgICAgaWYgKG5ld0ludGVydmFsICE9PSBudWxsKSB7XG4gICAgICAgICAgICB2YXIgbG9hZGluZyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl9pbnRlcnZhbCA9ICg8YW55PnNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgICAgICAgICBpZighbG9hZGluZylcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubG9hZFRhc2tzKChzdWNjZXNzLCBkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2FkaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIG5ld0ludGVydmFsICogMTAwMCkpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLmxvYWRUYXNrcygoc3VjY2VzcywgZGF0YSkgPT4ge1xuICAgICAgICAgICAgICAgIGxvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIHB1YmxpYyBzdG9wQmFja2dyb3VuZFVwZGF0ZSgpIHtcbiAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLl9pbnRlcnZhbCk7XG4gICAgfVxuICAgIFxuICAgIHB1YmxpYyBzZXRCYWNrZ3JvdW5kVXBkYXRlKHVwZGF0ZUluQmFja2dyb3VuZDogYm9vbGVhbiwgbmV3SW50ZXJ2YWxTZWNvbmRzOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5fc2V0dGluZ3MuYmFja2dyb3VuZFVwZGF0ZUludGVydmFsID0gbmV3SW50ZXJ2YWxTZWNvbmRzO1xuICAgICAgICB0aGlzLl9zZXR0aW5ncy51cGRhdGVJbkJhY2tncm91bmQgPSB1cGRhdGVJbkJhY2tncm91bmQ7XG4gICAgICAgIFxuICAgICAgICB0aGlzLnN0b3BCYWNrZ3JvdW5kVXBkYXRlKCk7XG4gICAgICAgIHRoaXMuc3RhcnRCYWNrZ3JvdW5kVXBkYXRlKCk7XG4gICAgfVxuICAgIFxuICAgIHB1YmxpYyBjcmVhdGVUYXNrKHVybDogc3RyaW5nLCB1c2VybmFtZTogc3RyaW5nLCBwYXNzd29yZDogc3RyaW5nLCB1bnppcFBhc3N3b3JkOiBzdHJpbmcsIGRlc3RpbmF0aW9uRm9sZGVyOiBzdHJpbmcsIGNhbGxiYWNrOiAoc3VjY2VzczogYm9vbGVhbiwgcmVzdWx0OiBhbnkgfCBzdHJpbmcpID0+IHZvaWQpIHtcbiAgICAgICAgdmFyIHVybHMgPSB0aGlzLmV4dHJhY3RVUkxzKHVybCk7XG4gICAgICAgIHZhciB1cmxUYXNrcyA9IG5ldyBBcnJheTxzdHJpbmc+KCk7XG4gICAgICAgIHZhciBmaWxlVGFza3MgPSBuZXcgQXJyYXk8c3RyaW5nPigpO1xuICAgICAgICB2YXIgdHlwZUNoZWNrUmVzdWx0Q291bnQgPSAwO1xuICAgIFxuICAgICAgICAkLmVhY2godXJscywgKGksIHVybCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5faXNUb3JyZW50T3JOemJVcmwodXJsLCB1c2VybmFtZSwgcGFzc3dvcmQsIChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0KVxuICAgICAgICAgICAgICAgICAgICBmaWxlVGFza3MucHVzaCh1cmwpO1xuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgdXJsVGFza3MucHVzaCh1cmwpO1xuICAgIFxuICAgICAgICAgICAgICAgIHR5cGVDaGVja1Jlc3VsdENvdW50Kys7XG4gICAgXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVDaGVja1Jlc3VsdENvdW50IDwgdXJscy5sZW5ndGgpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICBcbiAgICAgICAgICAgICAgICB2YXIgZmlsZVRhc2tzRmluaXNoZWQgPSAoZmlsZVRhc2tzLmxlbmd0aCA9PSAwKTtcbiAgICAgICAgICAgICAgICB2YXIgdXJsVGFza3NGaW5pc2hlZCA9ICh1cmxUYXNrcy5sZW5ndGggPT0gMCk7XG4gICAgICAgICAgICAgICAgdmFyIG92ZXJhbGxSZXN1bHQgPSB0cnVlO1xuICAgIFxuICAgICAgICAgICAgICAgIHZhciBjcmVhdGVSZXN1bHRIYW5kbGVyID0gKHN1Y2Nlc3M6IGJvb2xlYW4sIGRhdGE6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3VjY2VzcyA9PSBmYWxzZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIG92ZXJhbGxSZXN1bHQgPSBmYWxzZTtcbiAgICBcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZpbGVUYXNrc0ZpbmlzaGVkICYmIHVybFRhc2tzRmluaXNoZWQgJiYgdHlwZW9mIGNhbGxiYWNrID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG92ZXJhbGxSZXN1bHQsIGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgIFxuICAgICAgICAgICAgICAgIGlmICh1cmxUYXNrcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY3JlYXRlVGFza0Zyb21VcmwodXJsVGFza3MsIHVzZXJuYW1lLCBwYXNzd29yZCwgdW56aXBQYXNzd29yZCwgZGVzdGluYXRpb25Gb2xkZXIsIChzdWNjZXNzLCBkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1cmxUYXNrc0ZpbmlzaGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZVJlc3VsdEhhbmRsZXIoc3VjY2VzcywgZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICBcbiAgICAgICAgICAgICAgICBpZiAoZmlsZVRhc2tzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZpbGVUYXNrc1Jlc3VsdCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmaWxlVGFza3NDb3VudGVyID0gMDtcbiAgICBcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZpbGVUYXNrQWRkQ2FsbGJhY2sgPSAoc3VjY2VzczogYm9vbGVhbiwgZGF0YTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlVGFza3NDb3VudGVyKys7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3VjY2VzcyA9PSBmYWxzZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlVGFza3NSZXN1bHQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZpbGVUYXNrc0NvdW50ZXIgPT0gZmlsZVRhc2tzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVUYXNrc0ZpbmlzaGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVSZXN1bHRIYW5kbGVyKGZpbGVUYXNrc1Jlc3VsdCwgZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgXG4gICAgICAgICAgICAgICAgICAgICQuZWFjaChmaWxlVGFza3MsIChqLCBmaWxlVGFzaykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZG93bmxvYWRGaWxlKGZpbGVUYXNrLCB1c2VybmFtZSwgcGFzc3dvcmQsIChzdWNjZXNzLCBmaWxlKSA9PntcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3VjY2VzcyA9PT0gdHJ1ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jcmVhdGVUYXNrRnJvbUZpbGUoZmlsZSwgdW56aXBQYXNzd29yZCwgZGVzdGluYXRpb25Gb2xkZXIsIGZpbGVUYXNrQWRkQ2FsbGJhY2spO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jcmVhdGVUYXNrRnJvbVVybCh1cmwsIHVzZXJuYW1lLCBwYXNzd29yZCwgdW56aXBQYXNzd29yZCwgZGVzdGluYXRpb25Gb2xkZXIsIGZpbGVUYXNrQWRkQ2FsbGJhY2spO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgcHJpdmF0ZSBfZG93bmxvYWRGaWxlKHVybDogc3RyaW5nLCB1c2VybmFtZTogc3RyaW5nLCBwYXNzd29yZDogc3RyaW5nLCBjYWxsYmFjazogKHN1Y2Nlc3M6IGJvb2xlYW4sIGZpbGU/OiBEU0ZpbGUpID0+IHZvaWQpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgICAgIHhoci5vcGVuKCdHRVQnLCB1cmwsIHRydWUsIHVzZXJuYW1lLCBwYXNzd29yZCk7XG4gICAgICAgICAgICB4aHIucmVzcG9uc2VUeXBlID0gJ2FycmF5YnVmZmVyJztcbiAgICAgICAgICAgIHhoci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHhoci5zdGF0dXMgPj0gMjAwICYmIHhoci5zdGF0dXMgPCAzMDApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZpbGVuYW1lOiBzdHJpbmcgPSB0aGlzLl9nZXRGaWxlbmFtZUZyb21Db250ZW50RGlzcG9zaXRpb24oeGhyLmdldFJlc3BvbnNlSGVhZGVyKFwiQ29udGVudC1EaXNwb3NpdGlvblwiKSk7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZighZmlsZW5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlbmFtZSA9ICg8YW55PnVybCkucmVtb3ZlVXJsUGFyYW1ldGVycygpLnN1YnN0cmluZyh1cmwubGFzdEluZGV4T2YoJy8nKSArIDEpO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNvbnRlbnRUeXBlID0geGhyLmdldFJlc3BvbnNlSGVhZGVyKCdDb250ZW50LVR5cGUnKSB8fCBcImFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbVwiO1xuICAgICAgICAgICAgICAgICAgICB2YXIgZmlsZSA9IG5ldyBEU0ZpbGUoZmlsZW5hbWUsIGNvbnRlbnRUeXBlLCB4aHIucmVzcG9uc2UsIHVybCk7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZihmaWxlLmlzVmFsaWRGaWxlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKHRydWUsIGZpbGUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZmFsc2UpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHhoci5vbmVycm9yID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHhoci5zZW5kKCk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGV4Yykge1xuICAgICAgICAgICAgY2FsbGJhY2soZmFsc2UpO1xuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIHByaXZhdGUgX2dldEZpbGVuYW1lRnJvbUNvbnRlbnREaXNwb3NpdGlvbiAoY29udGVudERpc3Bvc2l0aW9uOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgICBpZighY29udGVudERpc3Bvc2l0aW9uIHx8IGNvbnRlbnREaXNwb3NpdGlvbi5pbmRleE9mKFwiZmlsZW5hbWU9XCIpID09PSAtMSlcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICBcbiAgICAgICAgdmFyIGZpbGVuYW1lID0gY29udGVudERpc3Bvc2l0aW9uLnNwbGl0KCdmaWxlbmFtZT0nKVsxXTtcbiAgICAgICAgaWYoZmlsZW5hbWUuaW5kZXhPZignXCInKSAhPT0gLTEpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGZpbGVuYW1lID0gZmlsZW5hbWUuc3BsaXQoJ1wiJylbMV07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBmaWxlbmFtZSA9IGZpbGVuYW1lLnNwbGl0KFwiIFwiKVswXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmlsZW5hbWU7XG4gICAgfVxuICAgIFxuICAgIHByaXZhdGUgZXh0cmFjdFVSTHModGV4dDogc3RyaW5nKSB7XG4gICAgICAgIHZhciBwYXR0ID0gbmV3IFJlZ0V4cChcIihodHRwcz98bWFnbmV0fHRodW5kZXJ8Zmxhc2hnZXR8cXFkbHxzP2Z0cHM/fGVkMmspKDovL3w6PylcXFxcUytcIiwgXCJpZ1wiKTtcbiAgICAgICAgdmFyIHVybHMgPSBuZXcgQXJyYXk8c3RyaW5nPigpO1xuICAgICAgICBkbyB7XG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0gcGF0dC5leGVjKHRleHQpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdmFyIHVybCA9IHJlc3VsdFswXTtcbiAgICAgICAgICAgICAgICBpZiAodXJsLmNoYXJBdCh1cmwubGVuZ3RoIC0gMSkgPT09IFwiLFwiKVxuICAgICAgICAgICAgICAgICAgICB1cmwgPSB1cmwuc3Vic3RyaW5nKDAsIHVybC5sZW5ndGggLSAxKTtcbiAgICAgICAgICAgICAgICB1cmxzLnB1c2godXJsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSB3aGlsZSAocmVzdWx0ICE9IG51bGwpO1xuICAgICAgICBpZiAodXJscy5sZW5ndGggPiAwKVxuICAgICAgICAgICAgcmV0dXJuIHVybHM7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHJldHVybiBbdGV4dF07XG4gICAgfVxuICAgIFxuICAgIHB1YmxpYyBnZXRGaW5pc2hlZFRhc2tzKCk6IEFycmF5PElEb3dubG9hZFN0YXRpb25UYXNrPiB7XG4gICAgICAgIHZhciBmaW5pc2hlZFRhc2tzID0gbmV3IEFycmF5PElEb3dubG9hZFN0YXRpb25UYXNrPigpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMudGFza3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciB0YXNrID0gdGhpcy50YXNrc1tpXTtcbiAgICAgICAgICAgIGlmICh0YXNrLnN0YXR1cyA9PSBcImZpbmlzaGVkXCIgfHwgKHRhc2suc2l6ZURvd25sb2FkZWQgPj0gdGFzay5zaXplICYmIHRhc2suc3RhdHVzID09IFwic2VlZGluZ1wiKSkgLy9DaGVjayBmb3Igc2l6ZURvd25sb2FkZWQgdG8gZGV0ZWN0IHNlZWRpbmcgdG9ycmVudHNcbiAgICAgICAgICAgICAgICBmaW5pc2hlZFRhc2tzLnB1c2godGFzayk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZpbmlzaGVkVGFza3M7XG4gICAgfVxuICAgIFxuICAgIHB1YmxpYyBkZXN0cm95KGNhbGxiYWNrPzogRnVuY3Rpb24pIHtcbiAgICAgICAgdGhpcy5sb2dvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5jb25uZWN0ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcihcImRlc3Ryb3lcIik7XG4gICAgICAgICAgICBpZihjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxuY2xhc3MgRFNGaWxlIHsgXG4gICAgXG4gICAgcHVibGljIGZpbGVuYW1lOiBzdHJpbmc7XG4gICAgcHVibGljIG1pbWVUeXBlOiBzdHJpbmc7XG4gICAgcHVibGljIHVybDogc3RyaW5nO1xuICAgIFxuICAgIHByaXZhdGUgZGF0YTogYW55O1xuICAgIHByaXZhdGUgYmxvYjogQmxvYiA9IG51bGw7XG4gICAgXG4gICAgY29uc3RydWN0b3IoZmlsZW5hbWU6IHN0cmluZywgbWltZVR5cGU6IHN0cmluZywgZGF0YTogYW55LCB1cmw6IHN0cmluZykge1xuICAgICAgICB0aGlzLmZpbGVuYW1lID0gJC50cmltKGZpbGVuYW1lKTtcbiAgICAgICAgdGhpcy5taW1lVHlwZSA9IG1pbWVUeXBlO1xuICAgICAgICB0aGlzLnVybCA9IHVybDtcbiAgICAgICAgdGhpcy5kYXRhID0gZGF0YTtcbiAgICAgICAgXG4gICAgICAgIC8vIEZpeCBmaWxlbmFtZVxuICAgICAgICBpZih0aGlzLm1pbWVUeXBlID09IFwiYXBwbGljYXRpb24veC1iaXR0b3JyZW50XCIgJiYgdGhpcy5maWxlbmFtZS5zdWJzdHIoLTgsIDgpLnRvTG93ZXJDYXNlKCkgIT0gXCIudG9ycmVudFwiKVxuICAgICAgICAgICAgdGhpcy5maWxlbmFtZSA9IFwiZG93bmxvYWQudG9ycmVudFwiO1xuICAgICAgICBlbHNlIGlmKHRoaXMubWltZVR5cGUgPT0gXCJhcHBsaWNhdGlvbi94LW56YlwiICYmIHRoaXMuZmlsZW5hbWUuc3Vic3RyKC00LCA0KS50b0xvd2VyQ2FzZSgpICE9IFwiLm56YlwiKVxuICAgICAgICAgICAgdGhpcy5maWxlbmFtZSA9IFwiZG93bmxvYWQubnpiXCI7XG4gICAgICAgIFxuICAgICAgICAvLyBGaXggbWltZS10eXBlXG4gICAgICAgIGlmKHRoaXMuZmlsZW5hbWUuc3Vic3RyKC04LCA4KS50b0xvd2VyQ2FzZSgpID09ICcudG9ycmVudCcpXG4gICAgICAgICAgICB0aGlzLm1pbWVUeXBlID0gXCJhcHBsaWNhdGlvbi94LWJpdHRvcnJlbnRcIjtcbiAgICAgICAgZWxzZSBpZih0aGlzLmZpbGVuYW1lLnN1YnN0cigtNCwgNCkudG9Mb3dlckNhc2UoKSA9PSBcIi5uemJcIilcbiAgICAgICAgICAgIHRoaXMubWltZVR5cGUgPSBcImFwcGxpY2F0aW9uL3gtbnpiXCI7XG5cdH1cblxuXHRwdWJsaWMgaXNWYWxpZEZpbGUoKTogYm9vbGVhbiB7XG5cdFx0aWYodGhpcy5taW1lVHlwZSAhPSBcImFwcGxpY2F0aW9uL3gtbnpiXCIgJiYgdGhpcy5taW1lVHlwZSAhPSBcImFwcGxpY2F0aW9uL3gtYml0dG9ycmVudFwiXG5cdFx0XHQmJiB0aGlzLmZpbGVuYW1lLnN1YnN0cigtOCwgOCkudG9Mb3dlckNhc2UoKSAhPSAnLnRvcnJlbnQnXG5cdFx0XHQmJiB0aGlzLmZpbGVuYW1lLnN1YnN0cigtNCwgNCkudG9Mb3dlckNhc2UoKSAhPSBcIi5uemJcIilcblx0XHR7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmdldEJsb2IoKSA9PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdFxuXHRwdWJsaWMgZ2V0QmxvYigpOiBCbG9iIHtcblx0XHRpZih0aGlzLmJsb2IgaW5zdGFuY2VvZiBCbG9iID09PSBmYWxzZSlcblx0XHRcdHRoaXMuY3JlYXRlQmxvYigpO1xuXHRcdHJldHVybiB0aGlzLmJsb2I7XG5cdH1cblx0XG5cdHByaXZhdGUgY3JlYXRlQmxvYigpIHtcblx0XHR0cnl7XG5cdFx0XHR0aGlzLmJsb2IgPSBuZXcgQmxvYiggW3RoaXMuZGF0YV0sIHsgdHlwZTogdGhpcy5taW1lVHlwZSB9KTtcblx0XHR9XG5cdFx0Y2F0Y2goZSl7XG5cdFx0XHRjb25zb2xlLmxvZyhcIkJsb2IgY29uc3RydWN0b3Igbm90IHN1cHBvcnRlZCwgZmFsbGluZyBiYWNrIHRvIEJsb2JCdWlsZGVyXCIpO1xuXHRcdFx0Ly8gT2xkIGJyb3dzZXJzXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciB3ID0gKDxhbnk+d2luZG93KTtcblx0XHRcdHZhciBibG9iQnVpbGRlciA9IHcuQmxvYkJ1aWxkZXIgfHwgXG5cdFx0XHRcdFx0XHRcdFx0XHR3LldlYktpdEJsb2JCdWlsZGVyIHx8IFxuXHRcdFx0XHRcdFx0XHRcdFx0dy5Nb3pCbG9iQnVpbGRlciB8fCBcblx0XHRcdFx0XHRcdFx0XHRcdHcuTVNCbG9iQnVpbGRlcjtcblx0XHRcdGlmKHcuQmxvYkJ1aWxkZXIpe1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHR2YXIgYmI6IE1TQmxvYkJ1aWxkZXIgPSBuZXcgYmxvYkJ1aWxkZXIoKTtcblx0XHRcdFx0ICAgIGJiLmFwcGVuZCh0aGlzLmRhdGEpO1xuXHRcdFx0XHQgICAgdGhpcy5ibG9iID0gYmIuZ2V0QmxvYih0aGlzLm1pbWVUeXBlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXRjaChiYkV4Y2VwdGlvbikge1xuXHRcdFx0XHRcdGNvbnNvbGUud2FybihcIkVycm9yIGluIEJsb2JCdWlsZGVyXCIpO1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKGJiRXhjZXB0aW9uKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKFwiQmxvYkJ1aWxkZXIgbm90IHN1cHBvcnRlZFwiKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn0iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=

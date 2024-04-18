/// <reference path="./lib/encryption.d.ts" />
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var DownloadStationAPI = (function (_super) {
    __extends(DownloadStationAPI, _super);
    function DownloadStationAPI(options) {
        _super.call(this, options);
        this._apiInfoFetched = false;
        this._apiInfo = {
            'SYNO.API.Info': {
                minVersion: 1,
                maxVersion: 1,
                path: 'query.cgi'
            }
        };
        this.fileStation = new FileStationAPI(this);
    }
    DownloadStationAPI.prototype._apiCall = function (apiName, apiMethod, apiVersion, params, callback, requestMethod, isUpload, retryOnError) {
        var _this = this;
        // Get QuickConnect connection details
        if (this._settings.quickConnectId && (!this._settings.protocol || !this._settings.url || !this._settings.port)) {
            this.getQuickConnectSettings(function (success, data) {
                if (success) {
                    // Apply the settings found with QuickConnect
                    _this._settings.protocol = data.protocol;
                    _this._settings.url = data.url;
                    _this._settings.port = data.port;
                    _this.deviceInfo.fullUrl = data.protocol + data.url + ":" + data.port;
                    _this._apiCall(apiName, apiMethod, apiVersion, params, callback, requestMethod, isUpload, retryOnError);
                }
                else {
                    _this._setStatus(data);
                    _this.trigger({ type: 'ready', success: success, message: data });
                    if (typeof callback === "function") {
                        callback(success, data);
                    }
                }
            });
            return;
        }
        if (!this._settings.protocol || !this._settings.url || !this._settings.port) {
            callback(false, this._getErrorString(apiName, 0));
            return;
        }
        if (this.deviceInfo.dsmVersion == null && apiName != "SYNO.DSM.Info" && apiName != "SYNO.API.Info" && apiName != 'SYNO.API.Encryption' && apiName != 'SYNO.API.Auth' && apiName != "SYNO.DownloadStation.Info") {
            this._setStatus("connecting");
            this.getDsmVersion(function (success, data) {
                if (success) {
                    if (typeof data.version_string === "string" && data.version_string.indexOf("-") != -1) {
                        data.version_string = $.trim(data.version_string.split("-")[0].replace("DSM", "").replace("SRM", ""));
                    }
                    _this.deviceInfo.dsmVersion = data.version;
                    _this.deviceInfo.dsmVersionString = data.version_string;
                    _this.deviceInfo.modelName = data.model;
                    _this.trigger("deviceInfoUpdated");
                    _this._setStatus(null);
                    _this._apiCall(apiName, apiMethod, apiVersion, params, callback, requestMethod, isUpload, retryOnError);
                }
                else {
                    _this._setStatus(data);
                    _this.trigger({ type: 'ready', success: success, message: data });
                    if (typeof callback === "function") {
                        callback(success, data);
                    }
                }
            });
            return;
        }
        if (this.deviceInfo.dsmVersion < 3100 && apiName != "SYNO.DSM.Info" && apiName != "SYNO.API.Info" && apiName != 'SYNO.API.Encryption' && apiName != 'SYNO.API.Auth' && apiName != "SYNO.DownloadStation.Info") {
            callback(false, "dsmVersionTooOld");
            return;
        }
        if (!this._apiInfoFetched && apiName != "SYNO.API.Info") {
            this._setStatus("connecting");
            this.getApiInfo(function (success, data) {
                if (success) {
                    _this._setStatus(null);
                    _this._apiCall(apiName, apiMethod, apiVersion, params, callback, requestMethod, isUpload, retryOnError);
                }
                else {
                    _this._setStatus(data);
                    _this.trigger({ type: 'ready', success: success, message: data });
                    if (typeof callback === "function") {
                        callback(success, data);
                    }
                }
            });
            return;
        }
        if (typeof (this._apiInfo[apiName]) === 'undefined') {
            var message = this._getErrorString(apiName, 102);
            callback(false, message);
            return;
        }
        if (!this._sid && apiName != 'SYNO.API.Info' && apiName != 'SYNO.API.Encryption' && apiName != 'SYNO.API.Auth') {
            this.login(function (success, data) {
                if (success) {
                    _this._apiCall(apiName, apiMethod, apiVersion, params, callback, requestMethod, isUpload, retryOnError);
                }
                else {
                    _this._setStatus(data);
                    if (typeof callback === "function") {
                        callback(success, data);
                    }
                }
                _this.trigger({ type: 'ready', success: success, message: data });
            });
            return;
        }
        var path = this._apiInfo[apiName].path;
        var isUpload = typeof isUpload === "boolean" ? isUpload : false;
        var retryOnError = typeof retryOnError === "boolean" ? retryOnError : false;
        var requestMethod = typeof requestMethod === "string" ? requestMethod : 'POST';
        var apiUrl = this._settings.protocol + this._settings.url + ':' + this._settings.port + '/webapi/' + path;
        var formData = new FormData();
        var data = {
            _sid: this._sid,
            api: apiName,
            version: apiVersion,
            method: apiMethod
        };
        if (typeof params === 'object')
            $.extend(data, params);
        if (isUpload) {
            for (var key in data) {
                if ((data[key] instanceof DSFile) === false)
                    formData.append(key, data[key]);
            }
            // Files should always be at the end of the request
            for (var key in data) {
                if (data[key] !== null && data[key] instanceof DSFile) {
                    var file = data[key];
                    formData.append(key, file.getBlob(), file.filename);
                }
            }
        }
        var retryOnErrorFunction = function () {
            _this.logout(function () {
                _this.login(function (success, data) {
                    if (success !== true) {
                        callback(false, data);
                    }
                    else {
                        _this._apiCall(apiName, apiMethod, apiVersion, params, callback, requestMethod, isUpload, false);
                    }
                });
            });
        };
        return $.ajax({
            type: requestMethod,
            url: apiUrl,
            dataType: 'json',
            data: isUpload ? formData : data,
            contentType: isUpload ? false : null,
            processData: !isUpload,
            timeout: 20000,
            cache: false
        })
            .done(function (data) {
            if (_this.connected === false && _this._sid) {
                _this.connected = true;
                _this.trigger("connected");
            }
            if (_this._sid && _this._settings.updateInBackground == false) {
                clearTimeout(_this._disconnectTimeout);
                _this._disconnectTimeout = setTimeout(function () {
                    if (_this.connected) {
                        _this.tasks = [];
                        _this.connected = false;
                        _this.trigger(["connectionLost", "tasksUpdated"]);
                    }
                }, 30000);
            }
            // No permission for API, makes session invalid and requires a new login
            if (data.success == false && data.error && data.error.code == 105) {
                _this._apiInfoFetched = false;
                _this._sid = null;
                _this.deviceInfo.loggedIn = false;
                _this.tasks = [];
                _this.connected = false;
                _this.trigger(["connectionLost", "tasksUpdated"]);
                retryOnError = false;
            }
            if (typeof (callback) === 'function') {
                if (data.success == true) {
                    callback(true, data.data);
                }
                else if (retryOnError === true && data.error && data.error.code < 400) {
                    // Login and retry
                    retryOnErrorFunction();
                }
                else if (retryOnError === true) {
                    // Retry without logging in
                    _this._apiCall(apiName, apiMethod, apiVersion, params, callback, requestMethod, isUpload, false);
                }
                else {
                    var errorcode;
                    if (typeof data === "undefined" || typeof data.error === "undefined" || typeof data.error.code == "undefined") {
                        errorcode = 0;
                    }
                    else {
                        errorcode = data.error.code;
                    }
                    var additionalErrors = data.error.errors;
                    var message = _this._getErrorString(apiName, errorcode);
                    if (Array.isArray(additionalErrors)) {
                        for (var i = 0; i < additionalErrors.length; i++) {
                            additionalErrors[i].message = _this._getErrorString(apiName, additionalErrors[i].code);
                        }
                    }
                    callback(false, message, additionalErrors);
                }
            }
        })
            .fail(function (xhr, textStatus, errorThrown) {
            if (_this.connected) {
                _this._apiInfoFetched = false;
                _this._sid = null;
                _this.deviceInfo.loggedIn = false;
                _this.tasks = [];
                _this.connected = false;
                _this.trigger(["connectionLost", "tasksUpdated"]);
            }
            if (typeof (callback) === 'function') {
                if (textStatus == "timeout") {
                    callback(false, "requestTimeout");
                }
                else {
                    callback(false, _this._getErrorString(apiName, 0));
                }
            }
        });
    };
    DownloadStationAPI.prototype._getErrorString = function (apiName, errorCode) {
        var generalErrors = {
            0: 'couldNotConnect',
            100: 'unknownError',
            101: 'invalidParameter',
            102: 'apiDoesNotExist',
            103: 'methodDoesNotExist',
            104: 'featureNotSupported',
            105: 'permissionDenied',
            106: 'sessionTimeout',
            107: 'sessionInterrupted'
        };
        var apiErrors = {
            'SYNO.API.Auth': {
                400: 'invalidUsernameOrPassword',
                401: 'accountDisabled',
                402: 'permissionDenied',
                403: 'twoStepVerificationCodeRequired',
                404: 'failedToAuthenticateVerificationCode'
            },
            'SYNO.DownloadStation.Info': {},
            'SYNO.DownloadStation.Task': {
                400: 'fileUploadFailed',
                401: 'maxNumberOfTasksReached',
                402: 'destinationDenied',
                403: 'destinationDoesNotExist',
                404: 'invalidTaskId',
                405: 'invalidTaskAction',
                406: 'noDefaultDestinationSet',
                407: 'setDestinationFailed',
                408: 'fileDoesNotExist'
            },
            'SYNO.DownloadStation.Statistic': {},
            'SYNO.DownloadStation.RSS.Site': {},
            'SYNO.DownloadStation.RSS.Feed': {},
            "SYNO.DownloadStation.BTSearch": {
                400: "unknownError",
                401: "invalidParameter",
                402: "parseUserSettingsFailed",
                403: "getCategoryFailed",
                404: "getSearchResultFailed",
                405: "getUserSettingsFailed"
            },
            "SYNO.FileStation": {
                400: "invalidParameter",
                401: "unknownError",
                402: "systemIsTooBusy",
                403: "fileOperationNotAllowedForUser",
                404: "fileOperationNotAllowedForGroup",
                405: "fileOperationNotAllowedForGroup",
                406: "couldNotGetPermissionInformationFromAccountServer",
                407: "fileStationOperationNotAllowed",
                408: "noSuchFileOrDirectory",
                409: "Non-supported file system",
                410: "failedToConnectToNetworkFileSystem",
                411: "readOnlyFileSystem",
                412: "fileOrFolderNameTooLongNonEncrypted",
                413: "fileOrFolderNameTooLongEncrypted",
                414: "fileOrFolderAlreadyExists",
                415: "diskQuotaExceeded",
                416: "noSpaceOnDevice",
                417: "fileStationIOError",
                418: "fileStationIllegalNameOrPath",
                419: "fileStationIllegalFileName",
                420: "fileStationIllegalFileNameFAT",
                421: "systemIsTooBusy",
                599: "No such task of the file operation" // Not translated
            },
            "SYNO.FileStation.Delete": {
                900: "Failed to delete file(s) or folder(s)." // Not translated
            },
            "SYNO.FileStation.CreateFolder": {
                1100: "fileStationFailedToCreateFolder",
                1101: "fileStationNumberOfFolderExceedsSystemLimitation"
            },
            "SYNO.FileStation.Rename": {
                1200: "fileStationFailedToRename"
            }
        };
        var message = generalErrors[errorCode];
        if (!message) {
            var apiNameArray = apiName.split(".");
            while (apiNameArray.length > 0 && !message) {
                var apiNamePart = apiNameArray.join(".");
                if (typeof (apiErrors[apiNamePart]) === "object") {
                    message = apiErrors[apiNamePart][errorCode];
                }
                apiNameArray.pop();
            }
        }
        return message ? message : 'unknownError';
    };
    DownloadStationAPI.prototype._createTaskObjects = function (dsTasks) {
        dsTasks.sort(function (a, b) {
            var timeStampA = parseInt(a.additional.detail.create_time);
            var timeStampB = parseInt(b.additional.detail.create_time);
            return (timeStampA < timeStampB) ? -1 : (timeStampA > timeStampB) ? 1 : 0;
        });
        var tasks = new Array();
        for (var i = 0; i < dsTasks.length; i++) {
            var task = dsTasks[i];
            var taskTitle;
            try {
                taskTitle = decodeURIComponent(task.title);
            }
            catch (error) {
                taskTitle = task.title;
            }
            var newTask = {
                id: task.id,
                type: task.type,
                title: taskTitle,
                size: parseInt(task.size),
                sizeString: this._bytesToString(task.size),
                status: task.status,
                errorDetail: task.status == "error" && task.status_extra ? task.status_extra.error_detail : null,
                downloadProgressString: ((parseInt(task.additional.transfer.size_downloaded) / parseInt(task.size)) * 100).toString() + "%",
                unzipProgress: task.status == "extracting" && task.status_extra ? task.status_extra.unzip_progress : null,
                unzipProgressString: task.status == "extracting" && task.status_extra && task.status_extra.unzip_progress ? task.status_extra.unzip_progress.toString() + "%" : null,
                sizeDownloaded: parseInt(task.additional.transfer.size_downloaded),
                sizeDownloadedString: this._bytesToString(parseInt(task.additional.transfer.size_downloaded)),
                sizeUploaded: parseInt(task.additional.transfer.size_uploaded),
                sizeUploadedString: this._bytesToString(parseInt(task.additional.transfer.size_uploaded)),
                speedDownload: parseInt(task.additional.transfer.speed_download),
                speedDownloadString: this._bytesToString(parseInt(task.additional.transfer.speed_download)) + "/s",
                speedUpload: parseInt(task.additional.transfer.speed_upload),
                speedUploadString: this._bytesToString(parseInt(task.additional.transfer.speed_upload)) + "/s"
            };
            newTask.uploadRatio = (parseInt(task.additional.transfer.size_uploaded) / parseInt(task.size)) * 100;
            newTask.uploadRatioString = (Math.round(newTask.uploadRatio * 100) / 100).toString() + "%";
            newTask.eta = null;
            newTask.etaString = null;
            if (!isNaN(newTask.speedDownload) && !isNaN(newTask.size) && !isNaN(newTask.sizeDownloaded)) {
                var remaining = newTask.size - newTask.sizeDownloaded;
                if (remaining > 0 && newTask.speedDownload > 0) {
                    newTask.eta = remaining / newTask.speedDownload;
                    newTask.etaString = secondsToStr(newTask.eta);
                }
                else if (remaining > 0) {
                    newTask.eta = null; // infinite
                    newTask.etaString = "8";
                }
            }
            tasks.push(newTask);
        }
        return tasks;
    };
    DownloadStationAPI.prototype.getSupportedFeatures = function (callback) {
        this.getApiInfo(function (success, data) {
            var features = {
                destinationFolder: false,
                fileStationDelete: false
            };
            if (success) {
                if (data['SYNO.DownloadStation.Task'] && data['SYNO.DownloadStation.Task'].minVersion <= 2
                    && data['SYNO.DownloadStation.Task'].maxVersion >= 2
                    && data['SYNO.FileStation.List']
                    && data['SYNO.FileStation.List'].minVersion <= 1
                    && data['SYNO.FileStation.List'].maxVersion >= 1) {
                    features.destinationFolder = true;
                }
                if (data['SYNO.FileStation.Delete'] && data['SYNO.FileStation.Delete'].minVersion >= 1
                    && data['SYNO.FileStation.Delete'].maxVersion <= 1) {
                    features.fileStationDelete = true;
                }
            }
            if (typeof callback === "function")
                callback(features);
        });
    };
    DownloadStationAPI.prototype.getApiInfo = function (callback) {
        var _this = this;
        var params = {
            query: 'ALL'
        };
        if (this._apiInfoFetched === true) {
            callback(true, this._apiInfo);
            return;
        }
        this._apiCall('SYNO.API.Info', 'query', 1, params, function (success, data) {
            if (success) {
                // Check presence of required API's
                if (typeof data['SYNO.API.Auth'] === 'object' && data['SYNO.API.Auth'].minVersion <= 2 && data['SYNO.API.Auth'].maxVersion >= 2 &&
                    typeof data['SYNO.DownloadStation.Info'] === 'object' && typeof data['SYNO.DownloadStation.Task'] === 'object' &&
                    typeof data['SYNO.DownloadStation.Schedule'] === 'object' && typeof data['SYNO.DownloadStation.Statistic'] === 'object') {
                    _this._apiInfo = data;
                    _this._apiInfoFetched = true;
                }
                else {
                    console.log("Not all required API's are supported at the required version.");
                    success = false;
                    data = 'requiredApisNotAvailable';
                }
            }
            if (typeof callback === "function")
                callback(success, data);
        }, 'GET', false, false);
    };
    DownloadStationAPI.prototype.getDownloadStationApiInfo = function (callback) {
        var _this = this;
        this._apiCall('SYNO.DownloadStation.Info', 'getinfo', 1, null, function (success, data) {
            if (success === true) {
                _this._isManager = data.is_manager;
                _this._version = data.version;
                _this._versionString = data.version_string;
            }
            if (typeof callback === "function")
                callback(success, data);
        }, null, false, false);
    };
    DownloadStationAPI.prototype.getDownloadStationConfig = function (callback) {
        this._apiCall("SYNO.DownloadStation.Info", "getconfig", 1, null, callback);
    };
    DownloadStationAPI.prototype.getDsmVersion = function (callback) {
        var _this = this;
        if (!this._settings.protocol || !this._settings.url || !this._settings.port) {
            if (typeof callback === "function") {
                callback(false, "couldNotConnect");
            }
            return;
        }
        var url = this._settings.protocol + this._settings.url + ":" + this._settings.port + "/webman/index.cgi";
        $.ajax({
            url: url,
            dataType: "html",
            timeout: 20000
        })
            .done(function (d) {
            var result = {};
            try {
                var data = $(d);
                var searchString = "SYNO.SDS.Session";
                var sessionInfo = $.trim(data.filter("script:not([src])").filter(":contains(" + searchString + ")").first().text());
                if (sessionInfo) {
                    sessionInfo = sessionInfo.replace("SYNO.SDS.Session = ", "").split("Ext.util.")[0];
                    sessionInfo = sessionInfo.replace(";", "");
                    var sessionInfoObj = JSON.parse(sessionInfo);
                    var deviceName = $.trim(sessionInfoObj.hostname);
                    if (deviceName.length > 0) {
                        _this.deviceInfo.deviceName = deviceName;
                    }
                    // DSM VERSION
                    // DSM <= 4.1
                    var scriptVersion = parseInt(data.filter('script[src]').first().attr('src').split('?v=').pop());
                    if (scriptVersion && scriptVersion < 3700) {
                        result.version = scriptVersion.toString();
                        result.version_string = _this._getDsmVersionString(scriptVersion);
                    }
                    else if (sessionInfoObj.fullversion) {
                        result.version = sessionInfoObj.fullversion.split("-")[0];
                        result.version_string = _this._getDsmVersionString(parseInt(result.version));
                    }
                    else if (sessionInfoObj.version) {
                        result.version = sessionInfoObj.version;
                        result.version_string = _this._getDsmVersionString(parseInt(result.version));
                    }
                }
                else {
                    var deviceName = data.filter("title").text().split(decodeURIComponent("-%C2%A0Synology"))[0].trim();
                    if (deviceName)
                        _this.deviceInfo.deviceName = deviceName;
                }
            }
            catch (exception) {
            }
            // DSM 5.0+
            if (!result.version || parseInt(result.version) > 4000) {
                _this.getApiInfo(function (success, data) {
                    if (!success) {
                        callback(false, data);
                        return;
                    }
                    var dsmInfoApi = data['SYNO.DSM.Info'];
                    if (dsmInfoApi.maxVersion == 1)
                        _this._apiCall('SYNO.DSM.Info', 'getinfo', 1, null, callback);
                    else
                        _this._apiCall('SYNO.DSM.Info', 'getinfo', 2, null, callback);
                });
            }
            else if (typeof callback === "function") {
                callback(true, result);
            }
        })
            .fail(function (xhr, textStatus, errorThrown) {
            if (typeof (callback) === 'function') {
                if (textStatus == "timeout") {
                    callback(false, "requestTimeout");
                }
                else {
                    callback(false, _this._getErrorString(null, 0));
                }
            }
        });
    };
    DownloadStationAPI.prototype.login = function (callback) {
        var _this = this;
        var clientTime = Math.floor((new Date()).getTime() / 1000);
        var params = {
            account: this._settings.username,
            passwd: this._settings.password,
            format: 'sid',
            session: "DownloadStation",
            client_time: clientTime,
            timezone: getGMTOffset(new Date())
        };
        this._setStatus("loggingIn");
        this._apiCall("SYNO.API.Encryption", "getinfo", 1, { format: "module" }, function (success, data) {
            if (success) {
                var cipherKey = data.cipherkey;
                var rsaModulus = data.public_key;
                var cipherToken = data.ciphertoken;
                var timeBias = data.server_time - Math.floor(+new Date() / 1000);
                var encryptedParams = SYNO.Encryption.EncryptParam(params, cipherKey, rsaModulus, cipherToken, timeBias);
                encryptedParams.client_time = clientTime;
                params = encryptedParams;
            }
            var authApiInfo = _this._apiInfo['SYNO.API.Auth'];
            var authApiVersion = 2;
            if (authApiInfo.maxVersion >= 4) {
                authApiVersion = 4;
            }
            _this._apiCall('SYNO.API.Auth', 'login', authApiVersion, params, function (success, data) {
                if (success) {
                    _this._sid = data.sid;
                    _this.getDownloadStationApiInfo(function (dsApiSuccess, dsApiData) {
                        if (dsApiSuccess) {
                            _this.loadTasks(function (tasksSuccess, tasksData) {
                                if (tasksSuccess) {
                                    _this.deviceInfo.loggedIn = true;
                                    _this._setStatus(null);
                                    _this.trigger("loginStatusChange");
                                }
                                else {
                                    _this.deviceInfo.loggedIn = false;
                                    _this._setStatus(tasksData);
                                    _this.trigger("loginStatusChange");
                                }
                                if (typeof callback === 'function')
                                    callback(tasksSuccess, tasksData);
                            });
                        }
                        else {
                            _this._sid = null;
                            _this.deviceInfo.loggedIn = false;
                            _this._setStatus(data);
                            _this.trigger("loginStatusChange");
                            if (typeof callback === 'function')
                                callback(dsApiSuccess, dsApiData);
                        }
                    });
                }
                else {
                    _this.deviceInfo.loggedIn = false;
                    _this._setStatus(data);
                    _this.trigger("loginStatusChange");
                    if (typeof callback === 'function')
                        callback(success, data);
                }
            }, null, false, false);
        });
    };
    DownloadStationAPI.prototype.logout = function (callback) {
        var _this = this;
        this.stopBackgroundUpdate();
        if (!this._sid) {
            if (typeof callback === "function")
                callback(true, null);
            return;
        }
        var params = {
            session: 'DownloadStation'
        };
        var authApiInfo = this._apiInfo['SYNO.API.Auth'];
        var authApiVersion = 2;
        if (authApiInfo.maxVersion >= 4) {
            authApiVersion = 4;
        }
        this._apiCall('SYNO.API.Auth', 'logout', authApiVersion, params, function (success, data) {
            _this.deviceInfo.loggedIn = false;
            _this._sid = null;
            _this.tasks = [];
            _this.trigger("tasksUpdated");
            _this.trigger({ type: 'loginStatusChange', success: success, data: data });
            if (typeof callback === "function")
                callback(success, data);
        }, null, false, false);
    };
    DownloadStationAPI.prototype.loadTasks = function (callback) {
        var _this = this;
        var params = {
            additional: 'transfer,detail',
            offset: 0,
            limit: 101
        };
        this._apiCall('SYNO.DownloadStation.Task', 'list', 1, params, function (success, data) {
            if (success) {
                _this.tasks = _this._createTaskObjects(data.tasks);
            }
            else {
                _this.tasks = [];
                _this._setStatus(data);
            }
            _this.trigger("tasksUpdated");
            if (typeof callback === "function")
                callback(success, data);
        });
    };
    DownloadStationAPI.prototype.createTaskFromUrl = function (url, username, password, unzipPassword, destinationFolder, callback) {
        var _this = this;
        if (!Array.isArray(url))
            url = [url];
        // Replace comma's in URL's with an percent-encoded comma. This causes the comma to be double-encoded
        // to %252C when posted to Download Station. Download Station interprets single-encoded comma's (%2C)
        // as seperation character for multiple URL's
        for (var i = 0; i < url.length; i++) {
            while (url[i].indexOf(",") !== -1) {
                url[i] = url[i].replace(",", encodeURIComponent(","));
            }
        }
        var params = {
            uri: url.join(",")
        };
        if (username)
            params.username = username;
        if (password)
            params.password = password;
        if (unzipPassword)
            params.unzip_password = unzipPassword;
        if (destinationFolder) {
            if (destinationFolder.charAt(0) == "/")
                destinationFolder = destinationFolder.substr(1);
            params.destination = destinationFolder;
        }
        this._apiCall('SYNO.DownloadStation.Task', 'create', 1, params, function (success, data) {
            _this.loadTasks();
            if (typeof callback === "function")
                callback(success, data);
        });
    };
    DownloadStationAPI.prototype.createTaskFromFile = function (file, unzipPassword, destinationFolder, callback) {
        var _this = this;
        var params = {
            file: file
        };
        if (unzipPassword) {
            params.unzip_password = unzipPassword;
        }
        if (destinationFolder) {
            if (destinationFolder.charAt(0) == "/") {
                destinationFolder = destinationFolder.substr(1);
            }
            params.destination = destinationFolder;
        }
        this._apiCall('SYNO.DownloadStation.Task', 'create', 1, params, function (success, data) {
            _this.loadTasks();
            if (typeof callback === "function")
                callback(success, data);
        }, 'POST', true);
    };
    DownloadStationAPI.prototype.clearFinishedTasks = function (callback) {
        var ids = new Array();
        for (var i = 0; i < this.tasks.length; i++) {
            var task = this.tasks[i];
            if (task.status === "finished") {
                ids.push(task.id);
            }
        }
        this.deleteTask(ids, callback);
    };
    ;
    DownloadStationAPI.prototype.resumeTask = function (ids, callback) {
        var _this = this;
        if (typeof ids === "string")
            ids = [ids];
        var params = {
            id: ids.join(",")
        };
        this._apiCall('SYNO.DownloadStation.Task', 'resume', 1, params, function (success, data) {
            _this.loadTasks();
            if (typeof callback === "function")
                callback(success, data);
        }, 'POST');
    };
    DownloadStationAPI.prototype.pauseTask = function (ids, callback) {
        var _this = this;
        if (typeof ids === "string")
            ids = [ids];
        var params = {
            id: ids.join(",")
        };
        this._apiCall('SYNO.DownloadStation.Task', 'pause', 1, params, function (success, data) {
            _this.loadTasks();
            if (typeof callback === "function")
                callback(success, data);
        }, 'POST');
    };
    DownloadStationAPI.prototype.deleteTask = function (ids, callback) {
        var _this = this;
        if (typeof ids === "string")
            ids = [ids];
        var params = {
            id: ids.join(","),
            force_complete: false
        };
        this._apiCall('SYNO.DownloadStation.Task', 'delete', 1, params, function (success, data) {
            _this.loadTasks();
            if (typeof callback === "function")
                callback(success, data);
        }, 'POST');
    };
    //!QuickConnect
    DownloadStationAPI.prototype.getQuickConnectServers = function (callback) {
        $.ajax({
            url: "https://global.quickconnect.to/Serv.php",
            data: JSON.stringify({
                version: 1,
                command: "get_site_list"
            }),
            processData: false,
            dataType: "json",
            method: "POST",
            timeout: 5000
        }).done(function (data) {
            if (data.errno != 0 || !data.sites || !Array.isArray(data.sites) || data.sites.length == 0) {
                callback(false);
                return;
            }
            callback(true, data.sites);
        }).fail(function () {
            callback(false);
        });
    };
    DownloadStationAPI.prototype.getQuickConnectDetails = function (serverUrl, https, callback) {
        $.ajax({
            url: "https://" + serverUrl + "/Serv.php",
            data: JSON.stringify({
                version: 1,
                command: "get_server_info",
                id: https ? "dsm_https" : "dsm",
                serverID: this._settings.quickConnectId
            }),
            dataType: "json",
            method: "POST",
            timeout: 5000
        }).done(function (data) {
            if (data.errno != 0 ||
                !data.server || !data.server.interface || !Array.isArray(data.server.interface) || !data.server.external || !data.server.serverID ||
                !data.service || data.service.port == null || data.service.ext_port == null) {
                callback(false);
                return;
            }
            var interfaces = [];
            var ezid = md5(data.server.serverID);
            // Device network interfaces
            for (var i = 0; i < data.server.interface.length; i++) {
                var interfaceDetails = data.server.interface[i];
                interfaces.push({
                    ip: interfaceDetails.ip,
                    port: data.service.port,
                    ezid: ezid
                });
            }
            var externalPort = data.service.ext_port === 0 ? data.service.port : data.service.ext_port;
            // Custom DNS
            if (data.server.fqdn) {
                interfaces.push({
                    ip: data.server.fqdn.replace(/'/g, ""),
                    port: externalPort,
                    ezid: ezid
                });
            }
            // DDNS
            if (data.server.ddns) {
                interfaces.push({
                    ip: data.server.ddns.replace(/'/g, ""),
                    port: externalPort,
                    ezid: ezid
                });
            }
            // Public IP
            interfaces.push({
                ip: data.server.external.ip,
                port: externalPort,
                ezid: ezid
            });
            callback(true, interfaces);
        }).fail(function () {
            callback(false);
        });
    };
    DownloadStationAPI.prototype.pingDiskStation = function (https, ip, port, callback) {
        var url = (https ? "https://" : "http://") + ip + ":" + port + "/webman/pingpong.cgi";
        $.ajax({
            url: url,
            dataType: "json",
            timeout: 20000,
            method: "GET"
        }).done(function (data) {
            if (data.success !== true) {
                callback(false);
                return;
            }
            if (data.boot_done !== true) {
                console.log("Device on url '%s' has not finished booting.", url);
                callback(false);
                return;
            }
            ;
            callback(true, data.ezid);
        }).fail(function () {
            callback(false);
        });
    };
    DownloadStationAPI.prototype.getQuickConnectSettings = function (callback) {
        var _this = this;
        var requireHttps = true;
        this.getQuickConnectServers(function (success, servers) {
            if (success == false || servers.length == 0) {
                callback(false, "quickConnectMainServerUnavailable");
                return;
            }
            var finishedRequestCount = 0;
            var resultFound = false;
            var pingInterfaces = function (interfaces, pingCallback) {
                var finishedPingCount = 0;
                var pingResponseFound = false;
                $.each(interfaces, function (index, currentInterface) {
                    _this.pingDiskStation(requireHttps, currentInterface.ip, currentInterface.port, function (success, ezid) {
                        finishedPingCount++;
                        if (pingResponseFound) {
                            return;
                        }
                        var validEzid = (ezid == currentInterface.ezid);
                        if ((success == false || validEzid == false) && finishedPingCount == interfaces.length) {
                            // No valid ping for any of the interfaces
                            pingCallback(false);
                            return;
                        }
                        if (success && validEzid) {
                            pingResponseFound = true;
                            pingCallback(true, currentInterface);
                            return;
                        }
                    });
                });
            };
            $.each(servers, function (index, currentServer) {
                _this.getQuickConnectDetails(currentServer, requireHttps, function (success, interfaces) {
                    finishedRequestCount++;
                    if (resultFound) {
                        return;
                    }
                    if (success == false && finishedRequestCount == servers.length) {
                        // All servers checked but no valid result
                        callback(false, "quickConnectInformationNotFound");
                        return;
                    }
                    if (success) {
                        // This is the first request that returned a result, use this one
                        resultFound = true;
                        pingInterfaces(interfaces, function (success, connectionDetails) {
                            if (success) {
                                callback(true, {
                                    url: connectionDetails.ip,
                                    port: connectionDetails.port,
                                    protocol: requireHttps ? "https://" : "http://"
                                });
                                return;
                            }
                            // Try QuickConnect tunnel
                            _this.requestQuickConnectRelay(currentServer, function (success, data) {
                                if (success) {
                                    callback(success, data);
                                }
                                else {
                                    callback(success, "quickConnectTunnelFailed");
                                }
                                return;
                            });
                        });
                    }
                });
            });
        });
    };
    DownloadStationAPI.prototype.requestQuickConnectRelay = function (serverUrl, callback) {
        var _this = this;
        var serverCode = serverUrl.split(".")[0];
        $.ajax({
            url: "https://" + serverUrl + "/Serv.php",
            data: JSON.stringify({
                version: 1,
                command: "request_tunnel",
                id: "dsm_https",
                serverID: this._settings.quickConnectId
            }),
            dataType: "json",
            method: "POST",
            timeout: 30000
        }).done(function (data) {
            if (data.errno != 0 || data.errno == undefined || !data.server || !data.server.external ||
                !data.server.serverID || !data.service || data.service.port == null || data.service.ext_port == null) {
                callback(false);
                return;
            }
            var hostname = _this._settings.quickConnectId + "." + serverCode.slice(0, 2) + ".quickconnect.to";
            var port = data.service.https_port ? data.service.https_port : 443;
            _this.pingDiskStation(true, hostname, port, function (success, ezid) {
                if (success == false || ezid != md5(data.server.serverID)) {
                    callback(false);
                }
                else {
                    callback(true, {
                        url: hostname,
                        port: port,
                        protocol: "https://"
                    });
                }
            });
        }).fail(function () {
            callback(false);
        });
    };
    return DownloadStationAPI;
}(DownloadStation));
function secondsToStr(s) {
    function numberEnding(n) {
        return (n > 1) ? 's' : '';
    }
    var temp = s;
    var timeParts = new Array();
    var years = Math.floor(temp / 31536000);
    if (years) {
        timeParts.push(years + " y");
    }
    var days = Math.floor((temp %= 31536000) / 86400);
    if (days) {
        timeParts.push(days + " d");
    }
    var hours = Math.floor((temp %= 86400) / 3600);
    if (hours) {
        timeParts.push(hours + " h");
    }
    var minutes = Math.floor((temp %= 3600) / 60);
    if (minutes) {
        timeParts.push(minutes + " m");
    }
    var seconds = Math.round(temp % 60);
    if (seconds) {
        timeParts.push(seconds + " s");
    }
    if (timeParts.length >= 2)
        return timeParts[0] + " " + timeParts[1];
    else if (timeParts.length == 1)
        return timeParts[0];
    else
        return 'less than a second'; //'just now' //or other string you like;
}
function getGMTOffset(date) {
    return (date.getTimezoneOffset() > 0 ? "-" : "+") +
        leftPad(Math.floor(Math.abs(date.getTimezoneOffset()) / 60), 2, "0") +
        ":" +
        leftPad(Math.abs(date.getTimezoneOffset() % 60), 2, "0");
}
function leftPad(d, b, c) {
    var a = String(d);
    if (!c) {
        c = " ";
    }
    while (a.length < b) {
        a = c + a;
    }
    ;
    return a;
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImpzL2Rvd25sb2Fkc3RhdGlvbi1hcGkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsOENBQThDOzs7Ozs7QUF3RTlDO0lBQWlDLHNDQUFlO0lBYTVDLDRCQUFZLE9BQWlDO1FBQ3pDLGtCQUFNLE9BQU8sQ0FBQyxDQUFDO1FBVlgsb0JBQWUsR0FBRyxLQUFLLENBQUM7UUFDeEIsYUFBUSxHQUF3QjtZQUNwQyxlQUFlLEVBQUU7Z0JBQ2IsVUFBVSxFQUFFLENBQUM7Z0JBQ2IsVUFBVSxFQUFFLENBQUM7Z0JBQ2IsSUFBSSxFQUFFLFdBQVc7YUFDcEI7U0FDSixDQUFDO1FBSUUsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBRU0scUNBQVEsR0FBZixVQUFnQixPQUFlLEVBQUUsU0FBaUIsRUFBRSxVQUFrQixFQUFFLE1BQTRCLEVBQUUsUUFBc0YsRUFBRSxhQUFzQixFQUFFLFFBQWtCLEVBQUUsWUFBc0I7UUFBaFEsaUJBdVFDO1FBdFFHLHNDQUFzQztRQUN0QyxFQUFFLENBQUEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FDOUcsQ0FBQztZQUNHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxVQUFDLE9BQU8sRUFBRSxJQUFJO2dCQUN2QyxFQUFFLENBQUEsQ0FBQyxPQUFPLENBQUMsQ0FDWCxDQUFDO29CQUNHLDZDQUE2QztvQkFDN0MsS0FBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztvQkFDeEMsS0FBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQztvQkFDOUIsS0FBSSxDQUFD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Q0FBQTtJQUNULENBQUM7SUFBQSxDQUFDO0lBQ0YsTUFBTSxDQUFDLENBQUMsQ0FBQztBQUNiLENBQUMiLCJmaWxlIjoianMvZG93bmxvYWRzdGF0aW9uLWFwaS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2xpYi9lbmNyeXB0aW9uLmQudHNcIiAvPlxyXG5cclxuaW50ZXJmYWNlIFN5bm9BcGlJbmZvUmVxdWVzdFxyXG57XHJcbiAgICBxdWVyeTogc3RyaW5nO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgU3lub0FwaUluZm9SZXNwb25zZVxyXG57XHJcbiAgICBba2V5OiBzdHJpbmddOiBTeW5vQXBpSW5mb0RldGFpbHM7XHJcbn1cclxuXHJcbmludGVyZmFjZSBTeW5vQXBpSW5mb0RldGFpbHNcclxue1xyXG4gICAgbWluVmVyc2lvbjogbnVtYmVyO1xyXG4gICAgbWF4VmVyc2lvbjogbnVtYmVyO1xyXG4gICAgcGF0aDogc3RyaW5nO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgU3lub0FwaVJlc3BvbnNlXHJcbntcclxuICAgIHN1Y2Nlc3M6IGJvb2xlYW47XHJcbiAgICBlcnJvcjogU3lub2xvZ3lBcGlFcnJvcjtcclxuICAgIGRhdGE/OiBhbnk7XHJcbn1cclxuXHJcbmludGVyZmFjZSBTeW5vbG9neUFwaUVycm9yXHJcbntcclxuICAgIGNvZGU6IG51bWJlcjtcclxuICAgIGVycm9yczogU3lub2xvZ3lBcGlFcnJvcltdO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgU3lub0FwaUF1dGhMb2dpblJlcXVlc3Rcclxue1xyXG4gICAgYWNjb3VudDogc3RyaW5nO1xyXG4gICAgcGFzc3dkOiBzdHJpbmc7XHJcbiAgICBmb3JtYXQ6IHN0cmluZztcclxuICAgIHNlc3Npb246IHN0cmluZztcclxuICAgIGNsaWVudF90aW1lOiBudW1iZXI7XHJcbiAgICB0aW1lem9uZTogc3RyaW5nO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgU3lub0RzbUluZm9SZXNwb25zZVxyXG57XHJcbiAgICBjb2RlcGFnZT86IHN0cmluZztcclxuICAgIG1vZGVsPzogc3RyaW5nO1xyXG4gICAgcmFtPzogbnVtYmVyO1xyXG4gICAgc2VyaWFsPzogc3RyaW5nO1xyXG4gICAgdGVtcGVyYXR1cmU/OiBudW1iZXI7XHJcbiAgICB0ZW1wZXJhdHVyZV93YXJuPzogYm9vbGVhbjtcclxuICAgIHRpbWU/OiBzdHJpbmc7XHJcbiAgICB1cHRpbWU/OiBudW1iZXI7XHJcbiAgICB2ZXJzaW9uPzogc3RyaW5nO1xyXG4gICAgdmVyc2lvbl9zdHJpbmc/OiBzdHJpbmc7XHJcbn1cclxuXHJcbmludGVyZmFjZSBTeW5vRG93bmxvYWRTdGF0aW9uVGFza0NyZWF0ZVJlcXVlc3Rcclxue1xyXG4gICAgdXJpPzogc3RyaW5nO1xyXG4gICAgZmlsZT86IERTRmlsZTtcclxuICAgIHVzZXJuYW1lPzogc3RyaW5nO1xyXG4gICAgcGFzc3dvcmQ/OiBzdHJpbmc7XHJcbiAgICB1bnppcF9wYXNzd29yZD86IHN0cmluZztcclxuICAgIGRlc3RpbmF0aW9uPzogc3RyaW5nO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgRmVhdHVyZVN1cHBvcnRJbmZvXHJcbntcclxuICAgIGRlc3RpbmF0aW9uRm9sZGVyOiBib29sZWFuO1xyXG4gICAgZmlsZVN0YXRpb25EZWxldGU6IGJvb2xlYW47XHJcbn1cclxuXHJcbmNsYXNzIERvd25sb2FkU3RhdGlvbkFQSSBleHRlbmRzIERvd25sb2FkU3RhdGlvblxyXG57XHJcbiAgICBwdWJsaWMgZmlsZVN0YXRpb246IEZpbGVTdGF0aW9uQVBJO1xyXG5cclxuICAgIHByaXZhdGUgX2FwaUluZm9GZXRjaGVkID0gZmFsc2U7XHJcbiAgICBwcml2YXRlIF9hcGlJbmZvOiBTeW5vQXBpSW5mb1Jlc3BvbnNlID0ge1xyXG4gICAgICAgICdTWU5PLkFQSS5JbmZvJzoge1xyXG4gICAgICAgICAgICBtaW5WZXJzaW9uOiAxLFxyXG4gICAgICAgICAgICBtYXhWZXJzaW9uOiAxLFxyXG4gICAgICAgICAgICBwYXRoOiAncXVlcnkuY2dpJ1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgY29uc3RydWN0b3Iob3B0aW9uczogSURvd25sb2FkU3RhdGlvblNldHRpbmdzKXtcclxuICAgICAgICBzdXBlcihvcHRpb25zKTtcclxuICAgICAgICB0aGlzLmZpbGVTdGF0aW9uID0gbmV3IEZpbGVTdGF0aW9uQVBJKHRoaXMpO1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBfYXBpQ2FsbChhcGlOYW1lOiBzdHJpbmcsIGFwaU1ldGhvZDogc3RyaW5nLCBhcGlWZXJzaW9uOiBudW1iZXIsIHBhcmFtczoge1trZXk6IHN0cmluZ106IGFueX0sIGNhbGxiYWNrOiAoc3VjY2VzczogYm9vbGVhbiwgZGF0YTogYW55LCBhZGRpdGlvbmFsRXJyb3JzPzogU3lub2xvZ3lBcGlFcnJvcltdKSA9PiB2b2lkLCByZXF1ZXN0TWV0aG9kPzogc3RyaW5nLCBpc1VwbG9hZD86IGJvb2xlYW4sIHJldHJ5T25FcnJvcj86IGJvb2xlYW4pIHtcclxuICAgICAgICAvLyBHZXQgUXVpY2tDb25uZWN0IGNvbm5lY3Rpb24gZGV0YWlsc1xyXG4gICAgICAgIGlmKHRoaXMuX3NldHRpbmdzLnF1aWNrQ29ubmVjdElkICYmICghdGhpcy5fc2V0dGluZ3MucHJvdG9jb2wgfHwgIXRoaXMuX3NldHRpbmdzLnVybCB8fCAhdGhpcy5fc2V0dGluZ3MucG9ydCkpXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICB0aGlzLmdldFF1aWNrQ29ubmVjdFNldHRpbmdzKChzdWNjZXNzLCBkYXRhKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZihzdWNjZXNzKVxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIEFwcGx5IHRoZSBzZXR0aW5ncyBmb3VuZCB3aXRoIFF1aWNrQ29ubmVjdFxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3NldHRpbmdzLnByb3RvY29sID0gZGF0YS5wcm90b2NvbDtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXR0aW5ncy51cmwgPSBkYXRhLnVybDtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXR0aW5ncy5wb3J0ID0gZGF0YS5wb3J0O1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGV2aWNlSW5mby5mdWxsVXJsID0gZGF0YS5wcm90b2NvbCArIGRhdGEudXJsICsgXCI6XCIgKyBkYXRhLnBvcnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYXBpQ2FsbChhcGlOYW1lLCBhcGlNZXRob2QsIGFwaVZlcnNpb24sIHBhcmFtcywgY2FsbGJhY2ssIHJlcXVlc3RNZXRob2QsIGlzVXBsb2FkLCByZXRyeU9uRXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3NldFN0YXR1cyhkYXRhKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnRyaWdnZXIoeyB0eXBlOiAncmVhZHknLCBzdWNjZXNzOiBzdWNjZXNzLCBtZXNzYWdlOiBkYXRhIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhzdWNjZXNzLCBkYXRhKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICghdGhpcy5fc2V0dGluZ3MucHJvdG9jb2wgfHwgIXRoaXMuX3NldHRpbmdzLnVybCB8fCAhdGhpcy5fc2V0dGluZ3MucG9ydClcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrKGZhbHNlLCB0aGlzLl9nZXRFcnJvclN0cmluZyhhcGlOYW1lLCAwKSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYodGhpcy5kZXZpY2VJbmZvLmRzbVZlcnNpb24gPT0gbnVsbCAmJiBhcGlOYW1lICE9IFwiU1lOTy5EU00uSW5mb1wiICYmIGFwaU5hbWUgIT0gXCJTWU5PLkFQSS5JbmZvXCIgJiYgYXBpTmFtZSAhPSAnU1lOTy5BUEkuRW5jcnlwdGlvbicgJiYgYXBpTmFtZSAhPSAnU1lOTy5BUEkuQXV0aCcgJiYgYXBpTmFtZSAhPSBcIlNZTk8uRG93bmxvYWRTdGF0aW9uLkluZm9cIilcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIHRoaXMuX3NldFN0YXR1cyhcImNvbm5lY3RpbmdcIik7XHJcbiAgICAgICAgICAgIHRoaXMuZ2V0RHNtVmVyc2lvbigoc3VjY2VzcywgZGF0YSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYoc3VjY2VzcylcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBpZih0eXBlb2YgZGF0YS52ZXJzaW9uX3N0cmluZyA9PT0gXCJzdHJpbmdcIiAmJiBkYXRhLnZlcnNpb25fc3RyaW5nLmluZGV4T2YoXCItXCIpICE9IC0xKVxyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YS52ZXJzaW9uX3N0cmluZyA9ICQudHJpbShkYXRhLnZlcnNpb25fc3RyaW5nLnNwbGl0KFwiLVwiKVswXS5yZXBsYWNlKFwiRFNNXCIsIFwiXCIpLnJlcGxhY2UoXCJTUk1cIiwgXCJcIikpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmRldmljZUluZm8uZHNtVmVyc2lvbiA9IGRhdGEudmVyc2lvbjtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmRldmljZUluZm8uZHNtVmVyc2lvblN0cmluZyA9IGRhdGEudmVyc2lvbl9zdHJpbmc7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kZXZpY2VJbmZvLm1vZGVsTmFtZSA9IGRhdGEubW9kZWw7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50cmlnZ2VyKFwiZGV2aWNlSW5mb1VwZGF0ZWRcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2V0U3RhdHVzKG51bGwpO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2FwaUNhbGwoYXBpTmFtZSwgYXBpTWV0aG9kLCBhcGlWZXJzaW9uLCBwYXJhbXMsIGNhbGxiYWNrLCByZXF1ZXN0TWV0aG9kLCBpc1VwbG9hZCwgcmV0cnlPbkVycm9yKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2VcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXRTdGF0dXMoZGF0YSk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50cmlnZ2VyKHsgdHlwZTogJ3JlYWR5Jywgc3VjY2Vzczogc3VjY2VzcywgbWVzc2FnZTogZGF0YSB9KTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSBcImZ1bmN0aW9uXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soc3VjY2VzcywgZGF0YSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZih0aGlzLmRldmljZUluZm8uZHNtVmVyc2lvbiA8IDMxMDAgJiYgYXBpTmFtZSAhPSBcIlNZTk8uRFNNLkluZm9cIiAmJiBhcGlOYW1lICE9IFwiU1lOTy5BUEkuSW5mb1wiICYmIGFwaU5hbWUgIT0gJ1NZTk8uQVBJLkVuY3J5cHRpb24nICYmIGFwaU5hbWUgIT0gJ1NZTk8uQVBJLkF1dGgnICYmIGFwaU5hbWUgIT0gXCJTWU5PLkRvd25sb2FkU3RhdGlvbi5JbmZvXCIpXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBjYWxsYmFjayhmYWxzZSwgXCJkc21WZXJzaW9uVG9vT2xkXCIpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmKCF0aGlzLl9hcGlJbmZvRmV0Y2hlZCAmJiBhcGlOYW1lICE9IFwiU1lOTy5BUEkuSW5mb1wiKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgdGhpcy5fc2V0U3RhdHVzKFwiY29ubmVjdGluZ1wiKTtcclxuICAgICAgICAgICAgdGhpcy5nZXRBcGlJbmZvKChzdWNjZXNzLCBkYXRhKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoc3VjY2VzcylcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXRTdGF0dXMobnVsbCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYXBpQ2FsbChhcGlOYW1lLCBhcGlNZXRob2QsIGFwaVZlcnNpb24sIHBhcmFtcywgY2FsbGJhY2ssIHJlcXVlc3RNZXRob2QsIGlzVXBsb2FkLCByZXRyeU9uRXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3NldFN0YXR1cyhkYXRhKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnRyaWdnZXIoeyB0eXBlOiAncmVhZHknLCBzdWNjZXNzOiBzdWNjZXNzLCBtZXNzYWdlOiBkYXRhIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhzdWNjZXNzLCBkYXRhKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICh0eXBlb2YgKHRoaXMuX2FwaUluZm9bYXBpTmFtZV0pID09PSAndW5kZWZpbmVkJylcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIHZhciBtZXNzYWdlID0gdGhpcy5fZ2V0RXJyb3JTdHJpbmcoYXBpTmFtZSwgMTAyKTtcclxuICAgICAgICAgICAgY2FsbGJhY2soZmFsc2UsIG1lc3NhZ2UpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmKCF0aGlzLl9zaWQgJiYgYXBpTmFtZSAhPSAnU1lOTy5BUEkuSW5mbycgJiYgYXBpTmFtZSAhPSAnU1lOTy5BUEkuRW5jcnlwdGlvbicgJiYgYXBpTmFtZSAhPSAnU1lOTy5BUEkuQXV0aCcpXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICB0aGlzLmxvZ2luKChzdWNjZXNzLCBkYXRhKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZihzdWNjZXNzKVxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2FwaUNhbGwoYXBpTmFtZSwgYXBpTWV0aG9kLCBhcGlWZXJzaW9uLCBwYXJhbXMsIGNhbGxiYWNrLCByZXF1ZXN0TWV0aG9kLCBpc1VwbG9hZCwgcmV0cnlPbkVycm9yKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2VcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXRTdGF0dXMoZGF0YSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhzdWNjZXNzLCBkYXRhKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHRoaXMudHJpZ2dlcih7IHR5cGU6ICdyZWFkeScsIHN1Y2Nlc3M6IHN1Y2Nlc3MsIG1lc3NhZ2U6IGRhdGEgfSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgcGF0aCA9IHRoaXMuX2FwaUluZm9bYXBpTmFtZV0ucGF0aDtcclxuICAgICAgICB2YXIgaXNVcGxvYWQgPSB0eXBlb2YgaXNVcGxvYWQgPT09IFwiYm9vbGVhblwiID8gaXNVcGxvYWQgOiBmYWxzZTtcclxuICAgICAgICB2YXIgcmV0cnlPbkVycm9yID0gdHlwZW9mIHJldHJ5T25FcnJvciA9PT0gXCJib29sZWFuXCIgPyByZXRyeU9uRXJyb3IgOiBmYWxzZTtcclxuICAgICAgICB2YXIgcmVxdWVzdE1ldGhvZCA9IHR5cGVvZiByZXF1ZXN0TWV0aG9kID09PSBcInN0cmluZ1wiID8gcmVxdWVzdE1ldGhvZCA6ICdQT1NUJztcclxuICAgICAgICB2YXIgYXBpVXJsID0gdGhpcy5fc2V0dGluZ3MucHJvdG9jb2wgKyB0aGlzLl9zZXR0aW5ncy51cmwgKyAnOicgKyB0aGlzLl9zZXR0aW5ncy5wb3J0ICsgJy93ZWJhcGkvJyArIHBhdGg7XHJcbiAgICAgICAgdmFyIGZvcm1EYXRhID0gbmV3IEZvcm1EYXRhKCk7XHJcbiAgICAgICAgdmFyIGRhdGE6IHtba2V5OiBzdHJpbmddOiBhbnl9ID0ge1xyXG4gICAgICAgICAgICBfc2lkOiB0aGlzLl9zaWQsXHJcbiAgICAgICAgICAgIGFwaTogYXBpTmFtZSxcclxuICAgICAgICAgICAgdmVyc2lvbjogYXBpVmVyc2lvbixcclxuICAgICAgICAgICAgbWV0aG9kOiBhcGlNZXRob2RcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBpZiAodHlwZW9mIHBhcmFtcyA9PT0gJ29iamVjdCcpXHJcbiAgICAgICAgICAgICQuZXh0ZW5kKGRhdGEsIHBhcmFtcyk7XHJcblxyXG4gICAgICAgIGlmIChpc1VwbG9hZCkge1xyXG4gICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gZGF0YSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKChkYXRhW2tleV0gaW5zdGFuY2VvZiBEU0ZpbGUpID09PSBmYWxzZSlcclxuICAgICAgICAgICAgICAgICAgICBmb3JtRGF0YS5hcHBlbmQoa2V5LCBkYXRhW2tleV0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBGaWxlcyBzaG91bGQgYWx3YXlzIGJlIGF0IHRoZSBlbmQgb2YgdGhlIHJlcXVlc3RcclxuICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIGRhdGEpIHtcclxuICAgICAgICAgICAgICAgIGlmIChkYXRhW2tleV0gIT09IG51bGwgJiYgZGF0YVtrZXldIGluc3RhbmNlb2YgRFNGaWxlKVxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBmaWxlOiBEU0ZpbGUgPSBkYXRhW2tleV07XHJcbiAgICAgICAgICAgICAgICAgICAgZm9ybURhdGEuYXBwZW5kKGtleSwgZmlsZS5nZXRCbG9iKCksIGZpbGUuZmlsZW5hbWUpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgcmV0cnlPbkVycm9yRnVuY3Rpb24gPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMubG9nb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMubG9naW4oKHN1Y2Nlc3MsIGRhdGEpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoc3VjY2VzcyAhPT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhmYWxzZSwgZGF0YSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9hcGlDYWxsKGFwaU5hbWUsIGFwaU1ldGhvZCwgYXBpVmVyc2lvbiwgcGFyYW1zLCBjYWxsYmFjaywgcmVxdWVzdE1ldGhvZCwgaXNVcGxvYWQsIGZhbHNlKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgcmV0dXJuICQuYWpheCh7XHJcbiAgICAgICAgICAgIHR5cGU6IHJlcXVlc3RNZXRob2QsXHJcbiAgICAgICAgICAgIHVybDogYXBpVXJsLFxyXG4gICAgICAgICAgICBkYXRhVHlwZTogJ2pzb24nLFxyXG4gICAgICAgICAgICBkYXRhOiBpc1VwbG9hZCA/IGZvcm1EYXRhIDogZGF0YSxcclxuICAgICAgICAgICAgY29udGVudFR5cGU6IGlzVXBsb2FkID8gZmFsc2UgOiBudWxsLFxyXG4gICAgICAgICAgICBwcm9jZXNzRGF0YTogIWlzVXBsb2FkLFxyXG4gICAgICAgICAgICB0aW1lb3V0OiAyMDAwMCxcclxuICAgICAgICAgICAgY2FjaGU6IGZhbHNlXHJcbiAgICAgICAgfSlcclxuICAgICAgICAuZG9uZSgoZGF0YTogU3lub0FwaVJlc3BvbnNlKSA9PiB7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZih0aGlzLmNvbm5lY3RlZCA9PT0gZmFsc2UgJiYgdGhpcy5fc2lkKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvbm5lY3RlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnRyaWdnZXIoXCJjb25uZWN0ZWRcIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmKHRoaXMuX3NpZCAmJiB0aGlzLl9zZXR0aW5ncy51cGRhdGVJbkJhY2tncm91bmQgPT0gZmFsc2UpIHtcclxuICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9kaXNjb25uZWN0VGltZW91dCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9kaXNjb25uZWN0VGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKHRoaXMuY29ubmVjdGVkKVxyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50YXNrcyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbm5lY3RlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnRyaWdnZXIoW1wiY29ubmVjdGlvbkxvc3RcIiwgXCJ0YXNrc1VwZGF0ZWRcIl0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0sIDxhbnk+MzAwMDApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBObyBwZXJtaXNzaW9uIGZvciBBUEksIG1ha2VzIHNlc3Npb24gaW52YWxpZCBhbmQgcmVxdWlyZXMgYSBuZXcgbG9naW5cclxuICAgICAgICAgICAgaWYoZGF0YS5zdWNjZXNzID09IGZhbHNlICYmIGRhdGEuZXJyb3IgJiYgZGF0YS5lcnJvci5jb2RlID09IDEwNSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fYXBpSW5mb0ZldGNoZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3NpZCA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmRldmljZUluZm8ubG9nZ2VkSW4gPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIHRoaXMudGFza3MgPSBbXTtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29ubmVjdGVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnRyaWdnZXIoW1wiY29ubmVjdGlvbkxvc3RcIiwgXCJ0YXNrc1VwZGF0ZWRcIl0pO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICByZXRyeU9uRXJyb3IgPSBmYWxzZTsgXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgKGNhbGxiYWNrKSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICAgICAgaWYgKGRhdGEuc3VjY2VzcyA9PSB0cnVlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sodHJ1ZSwgZGF0YS5kYXRhKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHJldHJ5T25FcnJvciA9PT0gdHJ1ZSAmJiBkYXRhLmVycm9yICYmIGRhdGEuZXJyb3IuY29kZSA8IDQwMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIExvZ2luIGFuZCByZXRyeVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHJ5T25FcnJvckZ1bmN0aW9uKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIGlmKHJldHJ5T25FcnJvciA9PT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIFJldHJ5IHdpdGhvdXQgbG9nZ2luZyBpblxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2FwaUNhbGwoYXBpTmFtZSwgYXBpTWV0aG9kLCBhcGlWZXJzaW9uLCBwYXJhbXMsIGNhbGxiYWNrLCByZXF1ZXN0TWV0aG9kLCBpc1VwbG9hZCwgZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGVycm9yY29kZTogbnVtYmVyO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZih0eXBlb2YgZGF0YSA9PT0gXCJ1bmRlZmluZWRcIiB8fCB0eXBlb2YgZGF0YS5lcnJvciA9PT0gXCJ1bmRlZmluZWRcIiB8fCB0eXBlb2YgZGF0YS5lcnJvci5jb2RlID09IFwidW5kZWZpbmVkXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3Jjb2RlID0gMDtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZXtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3Jjb2RlID0gZGF0YS5lcnJvci5jb2RlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICB2YXIgYWRkaXRpb25hbEVycm9ycyA9IGRhdGEuZXJyb3IuZXJyb3JzO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBtZXNzYWdlID0gdGhpcy5fZ2V0RXJyb3JTdHJpbmcoYXBpTmFtZSwgZXJyb3Jjb2RlKTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICBpZihBcnJheS5pc0FycmF5KGFkZGl0aW9uYWxFcnJvcnMpKVxyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IGFkZGl0aW9uYWxFcnJvcnMubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZGl0aW9uYWxFcnJvcnNbaV0ubWVzc2FnZSA9IHRoaXMuX2dldEVycm9yU3RyaW5nKGFwaU5hbWUsIGFkZGl0aW9uYWxFcnJvcnNbaV0uY29kZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZmFsc2UsIG1lc3NhZ2UsIGFkZGl0aW9uYWxFcnJvcnMpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSlcclxuICAgICAgICAuZmFpbCgoeGhyLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93bikgPT4ge1xyXG4gICAgICAgICAgICBpZih0aGlzLmNvbm5lY3RlZCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fYXBpSW5mb0ZldGNoZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3NpZCA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmRldmljZUluZm8ubG9nZ2VkSW4gPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIHRoaXMudGFza3MgPSBbXTtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29ubmVjdGVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnRyaWdnZXIoW1wiY29ubmVjdGlvbkxvc3RcIiwgXCJ0YXNrc1VwZGF0ZWRcIl0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAodHlwZW9mIChjYWxsYmFjaykgPT09ICdmdW5jdGlvbicpe1xyXG4gICAgICAgICAgICAgICAgaWYodGV4dFN0YXR1cyA9PSBcInRpbWVvdXRcIil7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZmFsc2UsIFwicmVxdWVzdFRpbWVvdXRcIik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNle1xyXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGZhbHNlLCB0aGlzLl9nZXRFcnJvclN0cmluZyhhcGlOYW1lLCAwKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcHJpdmF0ZSBfZ2V0RXJyb3JTdHJpbmcgKGFwaU5hbWU6IHN0cmluZywgZXJyb3JDb2RlOiBudW1iZXIpIHtcclxuICAgICAgICB2YXIgZ2VuZXJhbEVycm9yczoge1trZXk6IG51bWJlcl06IHN0cmluZ30gPSB7XHJcbiAgICAgICAgICAgIDA6ICdjb3VsZE5vdENvbm5lY3QnLFxyXG4gICAgICAgICAgICAxMDA6ICd1bmtub3duRXJyb3InLFxyXG4gICAgICAgICAgICAxMDE6ICdpbnZhbGlkUGFyYW1ldGVyJyxcclxuICAgICAgICAgICAgMTAyOiAnYXBpRG9lc05vdEV4aXN0JyxcclxuICAgICAgICAgICAgMTAzOiAnbWV0aG9kRG9lc05vdEV4aXN0JyxcclxuICAgICAgICAgICAgMTA0OiAnZmVhdHVyZU5vdFN1cHBvcnRlZCcsXHJcbiAgICAgICAgICAgIDEwNTogJ3Blcm1pc3Npb25EZW5pZWQnLFxyXG4gICAgICAgICAgICAxMDY6ICdzZXNzaW9uVGltZW91dCcsXHJcbiAgICAgICAgICAgIDEwNzogJ3Nlc3Npb25JbnRlcnJ1cHRlZCdcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB2YXIgYXBpRXJyb3JzOiB7W2tleTogc3RyaW5nXToge1trZXk6IG51bWJlcl06IHN0cmluZ319ID0ge1xyXG4gICAgICAgICAgICAnU1lOTy5BUEkuQXV0aCc6IHtcclxuICAgICAgICAgICAgICAgIDQwMDogJ2ludmFsaWRVc2VybmFtZU9yUGFzc3dvcmQnLFxyXG4gICAgICAgICAgICAgICAgNDAxOiAnYWNjb3VudERpc2FibGVkJyxcclxuICAgICAgICAgICAgICAgIDQwMjogJ3Blcm1pc3Npb25EZW5pZWQnLFxyXG4gICAgICAgICAgICAgICAgNDAzOiAndHdvU3RlcFZlcmlmaWNhdGlvbkNvZGVSZXF1aXJlZCcsXHJcbiAgICAgICAgICAgICAgICA0MDQ6ICdmYWlsZWRUb0F1dGhlbnRpY2F0ZVZlcmlmaWNhdGlvbkNvZGUnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICdTWU5PLkRvd25sb2FkU3RhdGlvbi5JbmZvJzoge1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAnU1lOTy5Eb3dubG9hZFN0YXRpb24uVGFzayc6IHtcclxuICAgICAgICAgICAgICAgIDQwMDogJ2ZpbGVVcGxvYWRGYWlsZWQnLFxyXG4gICAgICAgICAgICAgICAgNDAxOiAnbWF4TnVtYmVyT2ZUYXNrc1JlYWNoZWQnLFxyXG4gICAgICAgICAgICAgICAgNDAyOiAnZGVzdGluYXRpb25EZW5pZWQnLFxyXG4gICAgICAgICAgICAgICAgNDAzOiAnZGVzdGluYXRpb25Eb2VzTm90RXhpc3QnLFxyXG4gICAgICAgICAgICAgICAgNDA0OiAnaW52YWxpZFRhc2tJZCcsXHJcbiAgICAgICAgICAgICAgICA0MDU6ICdpbnZhbGlkVGFza0FjdGlvbicsXHJcbiAgICAgICAgICAgICAgICA0MDY6ICdub0RlZmF1bHREZXN0aW5hdGlvblNldCcsXHJcbiAgICAgICAgICAgICAgICA0MDc6ICdzZXREZXN0aW5hdGlvbkZhaWxlZCcsXHJcbiAgICAgICAgICAgICAgICA0MDg6ICdmaWxlRG9lc05vdEV4aXN0J1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAnU1lOTy5Eb3dubG9hZFN0YXRpb24uU3RhdGlzdGljJzoge1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAnU1lOTy5Eb3dubG9hZFN0YXRpb24uUlNTLlNpdGUnOiB7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICdTWU5PLkRvd25sb2FkU3RhdGlvbi5SU1MuRmVlZCc6IHtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXCJTWU5PLkRvd25sb2FkU3RhdGlvbi5CVFNlYXJjaFwiOiB7XHJcbiAgICAgICAgICAgICAgICA0MDA6IFwidW5rbm93bkVycm9yXCIsXHJcbiAgICAgICAgICAgICAgICA0MDE6IFwiaW52YWxpZFBhcmFtZXRlclwiLFxyXG4gICAgICAgICAgICAgICAgNDAyOiBcInBhcnNlVXNlclNldHRpbmdzRmFpbGVkXCIsXHJcbiAgICAgICAgICAgICAgICA0MDM6IFwiZ2V0Q2F0ZWdvcnlGYWlsZWRcIixcclxuICAgICAgICAgICAgICAgIDQwNDogXCJnZXRTZWFyY2hSZXN1bHRGYWlsZWRcIixcclxuICAgICAgICAgICAgICAgIDQwNTogXCJnZXRVc2VyU2V0dGluZ3NGYWlsZWRcIlxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBcIlNZTk8uRmlsZVN0YXRpb25cIjoge1xyXG4gICAgICAgICAgICAgICAgNDAwOiBcImludmFsaWRQYXJhbWV0ZXJcIixcclxuICAgICAgICAgICAgICAgIDQwMTogXCJ1bmtub3duRXJyb3JcIixcclxuICAgICAgICAgICAgICAgIDQwMjogXCJzeXN0ZW1Jc1Rvb0J1c3lcIixcclxuICAgICAgICAgICAgICAgIDQwMzogXCJmaWxlT3BlcmF0aW9uTm90QWxsb3dlZEZvclVzZXJcIixcclxuICAgICAgICAgICAgICAgIDQwNDogXCJmaWxlT3BlcmF0aW9uTm90QWxsb3dlZEZvckdyb3VwXCIsXHJcbiAgICAgICAgICAgICAgICA0MDU6IFwiZmlsZU9wZXJhdGlvbk5vdEFsbG93ZWRGb3JHcm91cFwiLFxyXG4gICAgICAgICAgICAgICAgNDA2OiBcImNvdWxkTm90R2V0UGVybWlzc2lvbkluZm9ybWF0aW9uRnJvbUFjY291bnRTZXJ2ZXJcIixcclxuICAgICAgICAgICAgICAgIDQwNzogXCJmaWxlU3RhdGlvbk9wZXJhdGlvbk5vdEFsbG93ZWRcIixcclxuICAgICAgICAgICAgICAgIDQwODogXCJub1N1Y2hGaWxlT3JEaXJlY3RvcnlcIixcclxuICAgICAgICAgICAgICAgIDQwOTogXCJOb24tc3VwcG9ydGVkIGZpbGUgc3lzdGVtXCIsIC8vIE5vdCB0cmFuc2xhdGVkXHJcbiAgICAgICAgICAgICAgICA0MTA6IFwiZmFpbGVkVG9Db25uZWN0VG9OZXR3b3JrRmlsZVN5c3RlbVwiLFxyXG4gICAgICAgICAgICAgICAgNDExOiBcInJlYWRPbmx5RmlsZVN5c3RlbVwiLFxyXG4gICAgICAgICAgICAgICAgNDEyOiBcImZpbGVPckZvbGRlck5hbWVUb29Mb25nTm9uRW5jcnlwdGVkXCIsXHJcbiAgICAgICAgICAgICAgICA0MTM6IFwiZmlsZU9yRm9sZGVyTmFtZVRvb0xvbmdFbmNyeXB0ZWRcIixcclxuICAgICAgICAgICAgICAgIDQxNDogXCJmaWxlT3JGb2xkZXJBbHJlYWR5RXhpc3RzXCIsXHJcbiAgICAgICAgICAgICAgICA0MTU6IFwiZGlza1F1b3RhRXhjZWVkZWRcIixcclxuICAgICAgICAgICAgICAgIDQxNjogXCJub1NwYWNlT25EZXZpY2VcIixcclxuICAgICAgICAgICAgICAgIDQxNzogXCJmaWxlU3RhdGlvbklPRXJyb3JcIixcclxuICAgICAgICAgICAgICAgIDQxODogXCJmaWxlU3RhdGlvbklsbGVnYWxOYW1lT3JQYXRoXCIsXHJcbiAgICAgICAgICAgICAgICA0MTk6IFwiZmlsZVN0YXRpb25JbGxlZ2FsRmlsZU5hbWVcIixcclxuICAgICAgICAgICAgICAgIDQyMDogXCJmaWxlU3RhdGlvbklsbGVnYWxGaWxlTmFtZUZBVFwiLFxyXG4gICAgICAgICAgICAgICAgNDIxOiBcInN5c3RlbUlzVG9vQnVzeVwiLFxyXG4gICAgICAgICAgICAgICAgNTk5OiBcIk5vIHN1Y2ggdGFzayBvZiB0aGUgZmlsZSBvcGVyYXRpb25cIiAvLyBOb3QgdHJhbnNsYXRlZFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBcIlNZTk8uRmlsZVN0YXRpb24uRGVsZXRlXCI6IHtcclxuICAgICAgICAgICAgICAgIDkwMDogXCJGYWlsZWQgdG8gZGVsZXRlIGZpbGUocykgb3IgZm9sZGVyKHMpLlwiIC8vIE5vdCB0cmFuc2xhdGVkXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFwiU1lOTy5GaWxlU3RhdGlvbi5DcmVhdGVGb2xkZXJcIjoge1xyXG4gICAgICAgICAgICAgICAgMTEwMDogXCJmaWxlU3RhdGlvbkZhaWxlZFRvQ3JlYXRlRm9sZGVyXCIsXHJcbiAgICAgICAgICAgICAgICAxMTAxOiBcImZpbGVTdGF0aW9uTnVtYmVyT2ZGb2xkZXJFeGNlZWRzU3lzdGVtTGltaXRhdGlvblwiXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFwiU1lOTy5GaWxlU3RhdGlvbi5SZW5hbWVcIjoge1xyXG4gICAgICAgICAgICAgICAgMTIwMDogXCJmaWxlU3RhdGlvbkZhaWxlZFRvUmVuYW1lXCJcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBtZXNzYWdlID0gZ2VuZXJhbEVycm9yc1tlcnJvckNvZGVdO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmKCFtZXNzYWdlKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgdmFyIGFwaU5hbWVBcnJheSA9IGFwaU5hbWUuc3BsaXQoXCIuXCIpO1xyXG4gICAgICAgICAgICB3aGlsZShhcGlOYW1lQXJyYXkubGVuZ3RoID4gMCAmJiAhbWVzc2FnZSl7XHJcbiAgICAgICAgICAgICAgICB2YXIgYXBpTmFtZVBhcnQgPSBhcGlOYW1lQXJyYXkuam9pbihcIi5cIik7XHJcbiAgICAgICAgICAgICAgICBpZih0eXBlb2YoYXBpRXJyb3JzW2FwaU5hbWVQYXJ0XSkgPT09IFwib2JqZWN0XCIpIHtcclxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlID0gYXBpRXJyb3JzW2FwaU5hbWVQYXJ0XVtlcnJvckNvZGVdO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBhcGlOYW1lQXJyYXkucG9wKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIG1lc3NhZ2UgPyBtZXNzYWdlIDogJ3Vua25vd25FcnJvcic7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHByaXZhdGUgX2NyZWF0ZVRhc2tPYmplY3RzKGRzVGFza3M6IEFycmF5PGFueT4pIHtcclxuICAgICAgICBkc1Rhc2tzLnNvcnQoKGEsIGIpID0+IHtcclxuICAgICAgICAgICAgdmFyIHRpbWVTdGFtcEEgPSBwYXJzZUludChhLmFkZGl0aW9uYWwuZGV0YWlsLmNyZWF0ZV90aW1lKTtcclxuICAgICAgICAgICAgdmFyIHRpbWVTdGFtcEIgPSBwYXJzZUludChiLmFkZGl0aW9uYWwuZGV0YWlsLmNyZWF0ZV90aW1lKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiAodGltZVN0YW1wQSA8IHRpbWVTdGFtcEIpID8gLTEgOiAodGltZVN0YW1wQSA+IHRpbWVTdGFtcEIpID8gMSA6IDA7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHRhc2tzID0gbmV3IEFycmF5PElEb3dubG9hZFN0YXRpb25UYXNrPigpO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZHNUYXNrcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICB2YXIgdGFzayA9IGRzVGFza3NbaV07XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgdGFza1RpdGxlOiBzdHJpbmc7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICB0YXNrVGl0bGUgPSBkZWNvZGVVUklDb21wb25lbnQodGFzay50aXRsZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY2F0Y2goZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIHRhc2tUaXRsZSA9IHRhc2sudGl0bGU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBuZXdUYXNrOiBJRG93bmxvYWRTdGF0aW9uVGFzayA9IHtcclxuICAgICAgICAgICAgICAgIGlkOiB0YXNrLmlkLFxyXG4gICAgICAgICAgICAgICAgdHlwZTogdGFzay50eXBlLFxyXG4gICAgICAgICAgICAgICAgdGl0bGU6IHRhc2tUaXRsZSxcclxuICAgICAgICAgICAgICAgIHNpemU6IHBhcnNlSW50KHRhc2suc2l6ZSksXHJcbiAgICAgICAgICAgICAgICBzaXplU3RyaW5nOiB0aGlzLl9ieXRlc1RvU3RyaW5nKHRhc2suc2l6ZSksXHJcbiAgICAgICAgICAgICAgICBzdGF0dXM6IHRhc2suc3RhdHVzLFxyXG4gICAgICAgICAgICAgICAgZXJyb3JEZXRhaWw6IHRhc2suc3RhdHVzID09IFwiZXJyb3JcIiAmJiB0YXNrLnN0YXR1c19leHRyYSA/IHRhc2suc3RhdHVzX2V4dHJhLmVycm9yX2RldGFpbCA6IG51bGwsXHJcbiAgICAgICAgICAgICAgICBkb3dubG9hZFByb2dyZXNzU3RyaW5nOiAoKHBhcnNlSW50KHRhc2suYWRkaXRpb25hbC50cmFuc2Zlci5zaXplX2Rvd25sb2FkZWQpIC8gcGFyc2VJbnQodGFzay5zaXplKSkgKiAxMDApLnRvU3RyaW5nKCkgKyBcIiVcIixcclxuICAgICAgICAgICAgICAgIHVuemlwUHJvZ3Jlc3M6IHRhc2suc3RhdHVzID09IFwiZXh0cmFjdGluZ1wiICYmIHRhc2suc3RhdHVzX2V4dHJhID8gdGFzay5zdGF0dXNfZXh0cmEudW56aXBfcHJvZ3Jlc3MgOiBudWxsLFxyXG4gICAgICAgICAgICAgICAgdW56aXBQcm9ncmVzc1N0cmluZzogdGFzay5zdGF0dXMgPT0gXCJleHRyYWN0aW5nXCIgJiYgdGFzay5zdGF0dXNfZXh0cmEgJiYgdGFzay5zdGF0dXNfZXh0cmEudW56aXBfcHJvZ3Jlc3MgPyB0YXNrLnN0YXR1c19leHRyYS51bnppcF9wcm9ncmVzcy50b1N0cmluZygpICsgXCIlXCIgOiBudWxsLFxyXG4gICAgICAgICAgICAgICAgc2l6ZURvd25sb2FkZWQ6IHBhcnNlSW50KHRhc2suYWRkaXRpb25hbC50cmFuc2Zlci5zaXplX2Rvd25sb2FkZWQpLFxyXG4gICAgICAgICAgICAgICAgc2l6ZURvd25sb2FkZWRTdHJpbmc6IHRoaXMuX2J5dGVzVG9TdHJpbmcocGFyc2VJbnQodGFzay5hZGRpdGlvbmFsLnRyYW5zZmVyLnNpemVfZG93bmxvYWRlZCkpLFxyXG4gICAgICAgICAgICAgICAgc2l6ZVVwbG9hZGVkOiBwYXJzZUludCh0YXNrLmFkZGl0aW9uYWwudHJhbnNmZXIuc2l6ZV91cGxvYWRlZCksXHJcbiAgICAgICAgICAgICAgICBzaXplVXBsb2FkZWRTdHJpbmc6IHRoaXMuX2J5dGVzVG9TdHJpbmcocGFyc2VJbnQodGFzay5hZGRpdGlvbmFsLnRyYW5zZmVyLnNpemVfdXBsb2FkZWQpKSxcclxuICAgICAgICAgICAgICAgIHNwZWVkRG93bmxvYWQ6IHBhcnNlSW50KHRhc2suYWRkaXRpb25hbC50cmFuc2Zlci5zcGVlZF9kb3dubG9hZCksXHJcbiAgICAgICAgICAgICAgICBzcGVlZERvd25sb2FkU3RyaW5nOiB0aGlzLl9ieXRlc1RvU3RyaW5nKHBhcnNlSW50KHRhc2suYWRkaXRpb25hbC50cmFuc2Zlci5zcGVlZF9kb3dubG9hZCkpICsgXCIvc1wiLFxyXG4gICAgICAgICAgICAgICAgc3BlZWRVcGxvYWQ6IHBhcnNlSW50KHRhc2suYWRkaXRpb25hbC50cmFuc2Zlci5zcGVlZF91cGxvYWQpLFxyXG4gICAgICAgICAgICAgICAgc3BlZWRVcGxvYWRTdHJpbmc6IHRoaXMuX2J5dGVzVG9TdHJpbmcocGFyc2VJbnQodGFzay5hZGRpdGlvbmFsLnRyYW5zZmVyLnNwZWVkX3VwbG9hZCkpICsgXCIvc1wiXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBuZXdUYXNrLnVwbG9hZFJhdGlvID0gKHBhcnNlSW50KHRhc2suYWRkaXRpb25hbC50cmFuc2Zlci5zaXplX3VwbG9hZGVkKSAvIHBhcnNlSW50KHRhc2suc2l6ZSkpICogMTAwO1xyXG4gICAgICAgICAgICBuZXdUYXNrLnVwbG9hZFJhdGlvU3RyaW5nID0gKE1hdGgucm91bmQobmV3VGFzay51cGxvYWRSYXRpbyAqIDEwMCkgLyAxMDApLnRvU3RyaW5nKCkgKyBcIiVcIjtcclxuICAgICAgICAgICAgbmV3VGFzay5ldGEgID0gbnVsbDtcclxuICAgICAgICAgICAgbmV3VGFzay5ldGFTdHJpbmcgPSBudWxsO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYoIWlzTmFOKG5ld1Rhc2suc3BlZWREb3dubG9hZCkgJiYgIWlzTmFOKG5ld1Rhc2suc2l6ZSkgJiYgIWlzTmFOKG5ld1Rhc2suc2l6ZURvd25sb2FkZWQpKXtcclxuICAgICAgICAgICAgICAgIHZhciByZW1haW5pbmcgPSBuZXdUYXNrLnNpemUgLSBuZXdUYXNrLnNpemVEb3dubG9hZGVkO1xyXG4gICAgICAgICAgICAgICAgaWYocmVtYWluaW5nID4gMCAmJiBuZXdUYXNrLnNwZWVkRG93bmxvYWQgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbmV3VGFzay5ldGEgPSByZW1haW5pbmcgLyBuZXdUYXNrLnNwZWVkRG93bmxvYWQ7XHJcbiAgICAgICAgICAgICAgICAgICAgbmV3VGFzay5ldGFTdHJpbmcgPSBzZWNvbmRzVG9TdHIobmV3VGFzay5ldGEpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSBpZihyZW1haW5pbmcgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbmV3VGFzay5ldGEgPSBudWxsOy8vIGluZmluaXRlXHJcbiAgICAgICAgICAgICAgICAgICAgbmV3VGFzay5ldGFTdHJpbmcgPSBcIjhcIjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdGFza3MucHVzaChuZXdUYXNrKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRhc2tzO1xyXG4gICAgfVxyXG4gICAgXHJcblxyXG4gICAgcHVibGljIGdldFN1cHBvcnRlZEZlYXR1cmVzKGNhbGxiYWNrOiAoZmVhdHVyZXM6IEZlYXR1cmVTdXBwb3J0SW5mbykgPT4gdm9pZCkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuZ2V0QXBpSW5mbygoc3VjY2VzcywgZGF0YSkgPT4ge1xyXG4gICAgICAgICAgICB2YXIgZmVhdHVyZXM6IEZlYXR1cmVTdXBwb3J0SW5mbyA9IHtcclxuICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uRm9sZGVyOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIGZpbGVTdGF0aW9uRGVsZXRlOiBmYWxzZVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHN1Y2Nlc3MpXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIGlmIChkYXRhWydTWU5PLkRvd25sb2FkU3RhdGlvbi5UYXNrJ10gJiYgZGF0YVsnU1lOTy5Eb3dubG9hZFN0YXRpb24uVGFzayddLm1pblZlcnNpb24gPD0gMlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJiYgZGF0YVsnU1lOTy5Eb3dubG9hZFN0YXRpb24uVGFzayddLm1heFZlcnNpb24gPj0gMlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJiYgZGF0YVsnU1lOTy5GaWxlU3RhdGlvbi5MaXN0J11cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICYmIGRhdGFbJ1NZTk8uRmlsZVN0YXRpb24uTGlzdCddLm1pblZlcnNpb24gPD0gMVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJiYgZGF0YVsnU1lOTy5GaWxlU3RhdGlvbi5MaXN0J10ubWF4VmVyc2lvbiA+PSAxKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZmVhdHVyZXMuZGVzdGluYXRpb25Gb2xkZXIgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAoZGF0YVsnU1lOTy5GaWxlU3RhdGlvbi5EZWxldGUnXSAmJiBkYXRhWydTWU5PLkZpbGVTdGF0aW9uLkRlbGV0ZSddLm1pblZlcnNpb24gPj0gMVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJiYgZGF0YVsnU1lOTy5GaWxlU3RhdGlvbi5EZWxldGUnXS5tYXhWZXJzaW9uIDw9IDEpIHtcclxuICAgICAgICAgICAgICAgICAgICBmZWF0dXJlcy5maWxlU3RhdGlvbkRlbGV0ZSA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmKHR5cGVvZiBjYWxsYmFjayA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZmVhdHVyZXMpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBnZXRBcGlJbmZvKGNhbGxiYWNrOiAoc3VjY2VzczogYm9vbGVhbiwgYXBpSW5mbzogYW55KSA9PiB2b2lkKSB7XHJcbiAgICAgICAgdmFyIHBhcmFtczogU3lub0FwaUluZm9SZXF1ZXN0ID0ge1xyXG4gICAgICAgICAgICBxdWVyeTogJ0FMTCdcclxuICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmKHRoaXMuX2FwaUluZm9GZXRjaGVkID09PSB0cnVlKSB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrKHRydWUsIHRoaXMuX2FwaUluZm8pO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLl9hcGlDYWxsKCdTWU5PLkFQSS5JbmZvJywgJ3F1ZXJ5JywgMSwgcGFyYW1zLCAoc3VjY2VzcywgZGF0YSkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAgICAgLy8gQ2hlY2sgcHJlc2VuY2Ugb2YgcmVxdWlyZWQgQVBJJ3NcclxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZGF0YVsnU1lOTy5BUEkuQXV0aCddID09PSAnb2JqZWN0JyAmJiBkYXRhWydTWU5PLkFQSS5BdXRoJ10ubWluVmVyc2lvbiA8PSAyICYmIGRhdGFbJ1NZTk8uQVBJLkF1dGgnXS5tYXhWZXJzaW9uID49IDIgJiZcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZW9mIGRhdGFbJ1NZTk8uRG93bmxvYWRTdGF0aW9uLkluZm8nXSA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIGRhdGFbJ1NZTk8uRG93bmxvYWRTdGF0aW9uLlRhc2snXSA9PT0gJ29iamVjdCcgJiZcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZW9mIGRhdGFbJ1NZTk8uRG93bmxvYWRTdGF0aW9uLlNjaGVkdWxlJ10gPT09ICdvYmplY3QnICYmIHR5cGVvZiBkYXRhWydTWU5PLkRvd25sb2FkU3RhdGlvbi5TdGF0aXN0aWMnXSA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hcGlJbmZvID0gZGF0YTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hcGlJbmZvRmV0Y2hlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJOb3QgYWxsIHJlcXVpcmVkIEFQSSdzIGFyZSBzdXBwb3J0ZWQgYXQgdGhlIHJlcXVpcmVkIHZlcnNpb24uXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICBkYXRhID0gJ3JlcXVpcmVkQXBpc05vdEF2YWlsYWJsZSc7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmKHR5cGVvZiBjYWxsYmFjayA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2soc3VjY2VzcywgZGF0YSk7XHJcbiAgICAgICAgfSwgJ0dFVCcsIGZhbHNlLCBmYWxzZSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHB1YmxpYyBnZXREb3dubG9hZFN0YXRpb25BcGlJbmZvKGNhbGxiYWNrOiAoc3VjY2VzczogYm9vbGVhbiwgZGF0YTogYW55KSA9PiB2b2lkKSB7XHJcbiAgICAgICAgdGhpcy5fYXBpQ2FsbCgnU1lOTy5Eb3dubG9hZFN0YXRpb24uSW5mbycsICdnZXRpbmZvJywgMSwgbnVsbCwgKHN1Y2Nlc3MsIGRhdGEpID0+IHtcclxuICAgICAgICAgICAgaWYgKHN1Y2Nlc3MgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX2lzTWFuYWdlciA9IGRhdGEuaXNfbWFuYWdlcjtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3ZlcnNpb24gPSBkYXRhLnZlcnNpb247XHJcbiAgICAgICAgICAgICAgICB0aGlzLl92ZXJzaW9uU3RyaW5nID0gZGF0YS52ZXJzaW9uX3N0cmluZztcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2soc3VjY2VzcywgZGF0YSk7XHJcbiAgICAgICAgfSwgbnVsbCwgZmFsc2UsIGZhbHNlKTtcclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgZ2V0RG93bmxvYWRTdGF0aW9uQ29uZmlnKGNhbGxiYWNrOiAoc3VjY2VzczogYm9vbGVhbiwgZGF0YTogYW55KSA9PiB2b2lkKSB7XHJcbiAgICAgICAgdGhpcy5fYXBpQ2FsbChcIlNZTk8uRG93bmxvYWRTdGF0aW9uLkluZm9cIiwgXCJnZXRjb25maWdcIiwgMSwgbnVsbCwgY2FsbGJhY2spO1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBnZXREc21WZXJzaW9uKGNhbGxiYWNrOiAoc3VjY2VzczogYm9vbGVhbiwgZGF0YTogYW55KSA9PiB2b2lkKSB7XHJcbiAgICAgICAgaWYoIXRoaXMuX3NldHRpbmdzLnByb3RvY29sIHx8ICF0aGlzLl9zZXR0aW5ncy51cmwgfHwgIXRoaXMuX3NldHRpbmdzLnBvcnQpXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBpZih0eXBlb2YgY2FsbGJhY2sgPT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZmFsc2UsIFwiY291bGROb3RDb25uZWN0XCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHVybCA9IHRoaXMuX3NldHRpbmdzLnByb3RvY29sICsgdGhpcy5fc2V0dGluZ3MudXJsICsgXCI6XCIgKyB0aGlzLl9zZXR0aW5ncy5wb3J0ICsgXCIvd2VibWFuL2luZGV4LmNnaVwiO1xyXG4gICAgICAgICQuYWpheCh7XHJcbiAgICAgICAgICAgIHVybDogdXJsLFxyXG4gICAgICAgICAgICBkYXRhVHlwZTogXCJodG1sXCIsXHJcbiAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAwXHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIC5kb25lKChkKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB2YXIgcmVzdWx0OiBTeW5vRHNtSW5mb1Jlc3BvbnNlID0ge307XHJcbiAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBkYXRhID0gJChkKTtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgc2VhcmNoU3RyaW5nID0gXCJTWU5PLlNEUy5TZXNzaW9uXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNlc3Npb25JbmZvID0gJC50cmltKGRhdGEuZmlsdGVyKFwic2NyaXB0Om5vdChbc3JjXSlcIikuZmlsdGVyKFwiOmNvbnRhaW5zKFwiICsgc2VhcmNoU3RyaW5nICsgXCIpXCIpLmZpcnN0KCkudGV4dCgpKTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICBpZihzZXNzaW9uSW5mbyl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlc3Npb25JbmZvID0gc2Vzc2lvbkluZm8ucmVwbGFjZShcIlNZTk8uU0RTLlNlc3Npb24gPSBcIiwgXCJcIikuc3BsaXQoXCJFeHQudXRpbC5cIilbMF07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlc3Npb25JbmZvID0gc2Vzc2lvbkluZm8ucmVwbGFjZShcIjtcIiwgXCJcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzZXNzaW9uSW5mb09iaiA9IEpTT04ucGFyc2Uoc2Vzc2lvbkluZm8pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGRldmljZU5hbWUgPSAkLnRyaW0oc2Vzc2lvbkluZm9PYmouaG9zdG5hbWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZihkZXZpY2VOYW1lLmxlbmd0aCA+IDApXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGV2aWNlSW5mby5kZXZpY2VOYW1lID0gZGV2aWNlTmFtZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBEU00gVkVSU0lPTlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBEU00gPD0gNC4xXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzY3JpcHRWZXJzaW9uID0gcGFyc2VJbnQoZGF0YS5maWx0ZXIoJ3NjcmlwdFtzcmNdJykuZmlyc3QoKS5hdHRyKCdzcmMnKS5zcGxpdCgnP3Y9JykucG9wKCkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZihzY3JpcHRWZXJzaW9uICYmIHNjcmlwdFZlcnNpb24gPCAzNzAwKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQudmVyc2lvbiA9IHNjcmlwdFZlcnNpb24udG9TdHJpbmcoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC52ZXJzaW9uX3N0cmluZyA9IHRoaXMuX2dldERzbVZlcnNpb25TdHJpbmcoc2NyaXB0VmVyc2lvbik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRFNNIDQuM1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmKHNlc3Npb25JbmZvT2JqLmZ1bGx2ZXJzaW9uKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQudmVyc2lvbiA9IHNlc3Npb25JbmZvT2JqLmZ1bGx2ZXJzaW9uLnNwbGl0KFwiLVwiKVswXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC52ZXJzaW9uX3N0cmluZyA9IHRoaXMuX2dldERzbVZlcnNpb25TdHJpbmcocGFyc2VJbnQocmVzdWx0LnZlcnNpb24pKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBEU00gNC4yXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYoc2Vzc2lvbkluZm9PYmoudmVyc2lvbilcclxuICAgICAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnZlcnNpb24gPSBzZXNzaW9uSW5mb09iai52ZXJzaW9uO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnZlcnNpb25fc3RyaW5nID0gdGhpcy5fZ2V0RHNtVmVyc2lvblN0cmluZyhwYXJzZUludChyZXN1bHQudmVyc2lvbikpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgZGV2aWNlTmFtZSA9IGRhdGEuZmlsdGVyKFwidGl0bGVcIikudGV4dCgpLnNwbGl0KGRlY29kZVVSSUNvbXBvbmVudChcIi0lQzIlQTBTeW5vbG9neVwiKSlbMF0udHJpbSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZihkZXZpY2VOYW1lKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZXZpY2VJbmZvLmRldmljZU5hbWUgPSBkZXZpY2VOYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhdGNoIChleGNlcHRpb24pIHtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gRFNNIDUuMCtcclxuICAgICAgICAgICAgICAgIGlmKCFyZXN1bHQudmVyc2lvbiB8fCBwYXJzZUludChyZXN1bHQudmVyc2lvbikgPiA0MDAwKVxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZ2V0QXBpSW5mbygoc3VjY2VzcywgZGF0YSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYoIXN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGZhbHNlLCBkYXRhKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGRzbUluZm9BcGkgPSBkYXRhWydTWU5PLkRTTS5JbmZvJ107XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKGRzbUluZm9BcGkubWF4VmVyc2lvbiA9PSAxKSAvLyBEU00gNi4wIGJldGEgMSBhbmQgb2xkZXJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2FwaUNhbGwoJ1NZTk8uRFNNLkluZm8nLCAnZ2V0aW5mbycsIDEsIG51bGwsIGNhbGxiYWNrKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSAvLyBEU00gNi4wIGJldGEgMiBhbmQgbGF0ZXJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2FwaUNhbGwoJ1NZTk8uRFNNLkluZm8nLCAnZ2V0aW5mbycsIDIsIG51bGwsIGNhbGxiYWNrKTsgXHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIGlmKHR5cGVvZiBjYWxsYmFjayA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKHRydWUsIHJlc3VsdCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIC5mYWlsKCh4aHIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIChjYWxsYmFjaykgPT09ICdmdW5jdGlvbicpe1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKHRleHRTdGF0dXMgPT0gXCJ0aW1lb3V0XCIpe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhmYWxzZSwgXCJyZXF1ZXN0VGltZW91dFwiKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZXtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZmFsc2UsIHRoaXMuX2dldEVycm9yU3RyaW5nKG51bGwsIDApKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBwdWJsaWMgbG9naW4oY2FsbGJhY2s6IChzdWNjZXNzOiBib29sZWFuLCBkYXRhOiBhbnkpID0+IHZvaWQpIHtcclxuICAgICAgICB2YXIgY2xpZW50VGltZSA9IE1hdGguZmxvb3IoKG5ldyBEYXRlKCkpLmdldFRpbWUoKSAvIDEwMDApO1xyXG4gICAgICAgIHZhciBwYXJhbXM6IFN5bm9BcGlBdXRoTG9naW5SZXF1ZXN0ID0ge1xyXG4gICAgICAgICAgICBhY2NvdW50OiB0aGlzLl9zZXR0aW5ncy51c2VybmFtZSxcclxuICAgICAgICAgICAgcGFzc3dkOiB0aGlzLl9zZXR0aW5ncy5wYXNzd29yZCxcclxuICAgICAgICAgICAgZm9ybWF0OiAnc2lkJyxcclxuICAgICAgICAgICAgc2Vzc2lvbjogXCJEb3dubG9hZFN0YXRpb25cIixcclxuICAgICAgICAgICAgY2xpZW50X3RpbWU6IGNsaWVudFRpbWUsXHJcbiAgICAgICAgICAgIHRpbWV6b25lOiBnZXRHTVRPZmZzZXQobmV3IERhdGUoKSlcclxuICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuX3NldFN0YXR1cyhcImxvZ2dpbmdJblwiKTtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLl9hcGlDYWxsKFwiU1lOTy5BUEkuRW5jcnlwdGlvblwiLCBcImdldGluZm9cIiwgMSwgeyBmb3JtYXQ6IFwibW9kdWxlXCIgfSwgKHN1Y2Nlc3MsIGRhdGEpID0+IHtcclxuICAgICAgICAgICAgaWYoc3VjY2VzcylcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgdmFyIGNpcGhlcktleSA9IGRhdGEuY2lwaGVya2V5O1xyXG4gICAgICAgICAgICAgICAgdmFyIHJzYU1vZHVsdXMgPSBkYXRhLnB1YmxpY19rZXk7XHJcbiAgICAgICAgICAgICAgICB2YXIgY2lwaGVyVG9rZW4gPSBkYXRhLmNpcGhlcnRva2VuO1xyXG4gICAgICAgICAgICAgICAgdmFyIHRpbWVCaWFzID0gZGF0YS5zZXJ2ZXJfdGltZSAtIE1hdGguZmxvb3IoK25ldyBEYXRlKCkgLyAxMDAwKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmFyIGVuY3J5cHRlZFBhcmFtcyA9IFNZTk8uRW5jcnlwdGlvbi5FbmNyeXB0UGFyYW0ocGFyYW1zLCBjaXBoZXJLZXksIHJzYU1vZHVsdXMsIGNpcGhlclRva2VuLCB0aW1lQmlhcyk7XHJcbiAgICAgICAgICAgICAgICBlbmNyeXB0ZWRQYXJhbXMuY2xpZW50X3RpbWUgPSBjbGllbnRUaW1lO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBwYXJhbXMgPSBlbmNyeXB0ZWRQYXJhbXM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBhdXRoQXBpSW5mbyA9IHRoaXMuX2FwaUluZm9bJ1NZTk8uQVBJLkF1dGgnXTtcclxuICAgICAgICAgICAgdmFyIGF1dGhBcGlWZXJzaW9uID0gMjtcclxuICAgICAgICAgICAgaWYoYXV0aEFwaUluZm8ubWF4VmVyc2lvbiA+PSA0KSB7XHJcbiAgICAgICAgICAgICAgICBhdXRoQXBpVmVyc2lvbiA9IDQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMuX2FwaUNhbGwoJ1NZTk8uQVBJLkF1dGgnLCAnbG9naW4nLCBhdXRoQXBpVmVyc2lvbiwgcGFyYW1zLCAoc3VjY2VzcywgZGF0YSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zaWQgPSBkYXRhLnNpZDtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmdldERvd25sb2FkU3RhdGlvbkFwaUluZm8oKGRzQXBpU3VjY2VzcywgZHNBcGlEYXRhKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKGRzQXBpU3VjY2Vzcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5sb2FkVGFza3MoKHRhc2tzU3VjY2VzcywgdGFza3NEYXRhKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYodGFza3NTdWNjZXNzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGV2aWNlSW5mby5sb2dnZWRJbiA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NldFN0YXR1cyhudWxsKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50cmlnZ2VyKFwibG9naW5TdGF0dXNDaGFuZ2VcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRldmljZUluZm8ubG9nZ2VkSW4gPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2V0U3RhdHVzKHRhc2tzRGF0YSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudHJpZ2dlcihcImxvZ2luU3RhdHVzQ2hhbmdlXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSAnZnVuY3Rpb24nKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayh0YXNrc1N1Y2Nlc3MsIHRhc2tzRGF0YSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NpZCA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRldmljZUluZm8ubG9nZ2VkSW4gPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NldFN0YXR1cyhkYXRhKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudHJpZ2dlcihcImxvZ2luU3RhdHVzQ2hhbmdlXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSAnZnVuY3Rpb24nKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGRzQXBpU3VjY2VzcywgZHNBcGlEYXRhKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kZXZpY2VJbmZvLmxvZ2dlZEluID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2V0U3RhdHVzKGRhdGEpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMudHJpZ2dlcihcImxvZ2luU3RhdHVzQ2hhbmdlXCIpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSAnZnVuY3Rpb24nKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhzdWNjZXNzLCBkYXRhKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSwgbnVsbCwgZmFsc2UsIGZhbHNlKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcHVibGljIGxvZ291dChjYWxsYmFjazogKHN1Y2Nlc3M6IGJvb2xlYW4sIGRhdGE6IGFueSkgPT4gdm9pZCkge1xyXG4gICAgICAgIHRoaXMuc3RvcEJhY2tncm91bmRVcGRhdGUoKTtcclxuICAgICAgICBcclxuICAgICAgICBpZighdGhpcy5fc2lkKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2sodHJ1ZSwgbnVsbCk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBwYXJhbXMgPSB7XHJcbiAgICAgICAgICAgIHNlc3Npb246ICdEb3dubG9hZFN0YXRpb24nXHJcbiAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgYXV0aEFwaUluZm8gPSB0aGlzLl9hcGlJbmZvWydTWU5PLkFQSS5BdXRoJ107XHJcbiAgICAgICAgdmFyIGF1dGhBcGlWZXJzaW9uID0gMjtcclxuICAgICAgICBpZihhdXRoQXBpSW5mby5tYXhWZXJzaW9uID49IDQpIHtcclxuICAgICAgICAgICAgYXV0aEFwaVZlcnNpb24gPSA0O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5fYXBpQ2FsbCgnU1lOTy5BUEkuQXV0aCcsICdsb2dvdXQnLCBhdXRoQXBpVmVyc2lvbiwgcGFyYW1zLCAoc3VjY2VzcywgZGF0YSkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmRldmljZUluZm8ubG9nZ2VkSW4gPSBmYWxzZTtcclxuICAgICAgICAgICAgdGhpcy5fc2lkID0gbnVsbDtcclxuICAgICAgICAgICAgdGhpcy50YXNrcyA9IFtdO1xyXG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIoXCJ0YXNrc1VwZGF0ZWRcIik7XHJcbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcih7IHR5cGU6ICdsb2dpblN0YXR1c0NoYW5nZScsIHN1Y2Nlc3M6IHN1Y2Nlc3MsIGRhdGE6IGRhdGEgfSk7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKHN1Y2Nlc3MsIGRhdGEpO1xyXG4gICAgICAgIH0sIG51bGwsIGZhbHNlLCBmYWxzZSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIGxvYWRUYXNrcyhjYWxsYmFjaz86IChzdWNjZXNzOiBib29sZWFuLCBkYXRhOiBhbnkpID0+IHZvaWQpIHtcclxuICAgICAgICB2YXIgcGFyYW1zID0ge1xyXG4gICAgICAgICAgICBhZGRpdGlvbmFsOiAndHJhbnNmZXIsZGV0YWlsJyxcclxuICAgICAgICAgICAgb2Zmc2V0OiAwLFxyXG4gICAgICAgICAgICBsaW1pdDogMTAxXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5fYXBpQ2FsbCgnU1lOTy5Eb3dubG9hZFN0YXRpb24uVGFzaycsICdsaXN0JywgMSwgcGFyYW1zLCAoc3VjY2VzcywgZGF0YSkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy50YXNrcyA9IHRoaXMuX2NyZWF0ZVRhc2tPYmplY3RzKGRhdGEudGFza3MpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy50YXNrcyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fc2V0U3RhdHVzKGRhdGEpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIoXCJ0YXNrc1VwZGF0ZWRcIik7XHJcblxyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhzdWNjZXNzLCBkYXRhKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcHVibGljIGNyZWF0ZVRhc2tGcm9tVXJsKHVybDogc3RyaW5nW10sIHVzZXJuYW1lOiBzdHJpbmcsIHBhc3N3b3JkOiBzdHJpbmcsIHVuemlwUGFzc3dvcmQ6IHN0cmluZywgZGVzdGluYXRpb25Gb2xkZXI6IHN0cmluZywgY2FsbGJhY2s6IChzdWNjZXNzOiBib29sZWFuLCBkYXRhOiBhbnkpID0+IHZvaWQpIHtcclxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkodXJsKSlcclxuICAgICAgICAgICAgdXJsID0gWyg8YW55PnVybCldO1xyXG5cclxuICAgICAgICAvLyBSZXBsYWNlIGNvbW1hJ3MgaW4gVVJMJ3Mgd2l0aCBhbiBwZXJjZW50LWVuY29kZWQgY29tbWEuIFRoaXMgY2F1c2VzIHRoZSBjb21tYSB0byBiZSBkb3VibGUtZW5jb2RlZFxyXG4gICAgICAgIC8vIHRvICUyNTJDIHdoZW4gcG9zdGVkIHRvIERvd25sb2FkIFN0YXRpb24uIERvd25sb2FkIFN0YXRpb24gaW50ZXJwcmV0cyBzaW5nbGUtZW5jb2RlZCBjb21tYSdzICglMkMpXHJcbiAgICAgICAgLy8gYXMgc2VwZXJhdGlvbiBjaGFyYWN0ZXIgZm9yIG11bHRpcGxlIFVSTCdzXHJcbiAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IHVybC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICB3aGlsZSh1cmxbaV0uaW5kZXhPZihcIixcIikgIT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICB1cmxbaV0gPSB1cmxbaV0ucmVwbGFjZShcIixcIiwgZW5jb2RlVVJJQ29tcG9uZW50KFwiLFwiKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHBhcmFtczogU3lub0Rvd25sb2FkU3RhdGlvblRhc2tDcmVhdGVSZXF1ZXN0ID0ge1xyXG4gICAgICAgICAgICB1cmk6IHVybC5qb2luKFwiLFwiKVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmICh1c2VybmFtZSlcclxuICAgICAgICAgICAgcGFyYW1zLnVzZXJuYW1lID0gdXNlcm5hbWU7XHJcblxyXG4gICAgICAgIGlmIChwYXNzd29yZClcclxuICAgICAgICAgICAgcGFyYW1zLnBhc3N3b3JkID0gcGFzc3dvcmQ7XHJcblxyXG4gICAgICAgIGlmICh1bnppcFBhc3N3b3JkKVxyXG4gICAgICAgICAgICBwYXJhbXMudW56aXBfcGFzc3dvcmQgPSB1bnppcFBhc3N3b3JkO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmKGRlc3RpbmF0aW9uRm9sZGVyKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgaWYoZGVzdGluYXRpb25Gb2xkZXIuY2hhckF0KDApID09IFwiL1wiKVxyXG4gICAgICAgICAgICAgICAgZGVzdGluYXRpb25Gb2xkZXIgPSBkZXN0aW5hdGlvbkZvbGRlci5zdWJzdHIoMSk7XHJcbiAgICAgICAgICAgIHBhcmFtcy5kZXN0aW5hdGlvbiA9IGRlc3RpbmF0aW9uRm9sZGVyO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5fYXBpQ2FsbCgnU1lOTy5Eb3dubG9hZFN0YXRpb24uVGFzaycsICdjcmVhdGUnLCAxLCBwYXJhbXMsIChzdWNjZXNzLCBkYXRhKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMubG9hZFRhc2tzKCk7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKHN1Y2Nlc3MsIGRhdGEpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBjcmVhdGVUYXNrRnJvbUZpbGUoZmlsZTogRFNGaWxlLCB1bnppcFBhc3N3b3JkOiBzdHJpbmcsIGRlc3RpbmF0aW9uRm9sZGVyOiBzdHJpbmcsIGNhbGxiYWNrOiAoc3VjY2VzczogYm9vbGVhbiwgZGF0YTogYW55KSA9PiB2b2lkKSB7XHJcbiAgICAgICAgdmFyIHBhcmFtczogU3lub0Rvd25sb2FkU3RhdGlvblRhc2tDcmVhdGVSZXF1ZXN0ID0ge1xyXG4gICAgICAgICAgICBmaWxlOiBmaWxlXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgaWYgKHVuemlwUGFzc3dvcmQpIHtcclxuICAgICAgICAgICAgcGFyYW1zLnVuemlwX3Bhc3N3b3JkID0gdW56aXBQYXNzd29yZDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYoZGVzdGluYXRpb25Gb2xkZXIpXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBpZihkZXN0aW5hdGlvbkZvbGRlci5jaGFyQXQoMCkgPT0gXCIvXCIpIHtcclxuICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uRm9sZGVyID0gZGVzdGluYXRpb25Gb2xkZXIuc3Vic3RyKDEpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHBhcmFtcy5kZXN0aW5hdGlvbiA9IGRlc3RpbmF0aW9uRm9sZGVyO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB0aGlzLl9hcGlDYWxsKCdTWU5PLkRvd25sb2FkU3RhdGlvbi5UYXNrJywgJ2NyZWF0ZScsIDEsIHBhcmFtcywgKHN1Y2Nlc3MsIGRhdGEpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5sb2FkVGFza3MoKTtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2soc3VjY2VzcywgZGF0YSk7XHJcbiAgICAgICAgfSwgJ1BPU1QnLCB0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgY2xlYXJGaW5pc2hlZFRhc2tzKGNhbGxiYWNrOiAoc3VjY2VzczogYm9vbGVhbiwgZGF0YTogYW55KSA9PiB2b2lkKSB7XHJcbiAgICAgICAgdmFyIGlkcyA9IG5ldyBBcnJheTxzdHJpbmc+KCk7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnRhc2tzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciB0YXNrID0gdGhpcy50YXNrc1tpXTtcclxuICAgICAgICAgICAgaWYgKHRhc2suc3RhdHVzID09PSBcImZpbmlzaGVkXCIpIHtcclxuICAgICAgICAgICAgICAgIGlkcy5wdXNoKHRhc2suaWQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmRlbGV0ZVRhc2soaWRzLCBjYWxsYmFjayk7XHJcbiAgICB9O1xyXG5cclxuICAgIHB1YmxpYyByZXN1bWVUYXNrKGlkczogc3RyaW5nW10sIGNhbGxiYWNrOiAoc3VjY2VzczogYm9vbGVhbiwgZGF0YTogYW55KSA9PiB2b2lkKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBpZHMgPT09IFwic3RyaW5nXCIpXHJcbiAgICAgICAgICAgIGlkcyA9IFsoPGFueT5pZHMpXTtcclxuXHJcbiAgICAgICAgdmFyIHBhcmFtcyA9IHtcclxuICAgICAgICAgICAgaWQ6IGlkcy5qb2luKFwiLFwiKVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuX2FwaUNhbGwoJ1NZTk8uRG93bmxvYWRTdGF0aW9uLlRhc2snLCAncmVzdW1lJywgMSwgcGFyYW1zLCAoc3VjY2VzcywgZGF0YSkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmxvYWRUYXNrcygpO1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhzdWNjZXNzLCBkYXRhKTtcclxuICAgICAgICB9LCAnUE9TVCcpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBwdWJsaWMgcGF1c2VUYXNrKGlkczogc3RyaW5nW10sIGNhbGxiYWNrOiAoc3VjY2VzczogYm9vbGVhbiwgZGF0YTogYW55KSA9PiB2b2lkKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBpZHMgPT09IFwic3RyaW5nXCIpXHJcbiAgICAgICAgICAgIGlkcyA9IFsoPGFueT5pZHMpXTtcclxuXHJcbiAgICAgICAgdmFyIHBhcmFtcyA9IHtcclxuICAgICAgICAgICAgaWQ6IGlkcy5qb2luKFwiLFwiKVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuX2FwaUNhbGwoJ1NZTk8uRG93bmxvYWRTdGF0aW9uLlRhc2snLCAncGF1c2UnLCAxLCBwYXJhbXMsIChzdWNjZXNzLCBkYXRhKSA9PntcclxuICAgICAgICAgICAgdGhpcy5sb2FkVGFza3MoKTtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2soc3VjY2VzcywgZGF0YSk7XHJcbiAgICAgICAgfSwgJ1BPU1QnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcHVibGljIGRlbGV0ZVRhc2soaWRzOiBzdHJpbmdbXSwgY2FsbGJhY2s6IChzdWNjZXNzOiBib29sZWFuLCBkYXRhOiBhbnkpID0+IHZvaWQpIHtcclxuICAgICAgICBpZiAodHlwZW9mIGlkcyA9PT0gXCJzdHJpbmdcIilcclxuICAgICAgICAgICAgaWRzID0gWyg8YW55PmlkcyldO1xyXG5cclxuICAgICAgICB2YXIgcGFyYW1zID0ge1xyXG4gICAgICAgICAgICBpZDogaWRzLmpvaW4oXCIsXCIpLFxyXG4gICAgICAgICAgICBmb3JjZV9jb21wbGV0ZTogZmFsc2VcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLl9hcGlDYWxsKCdTWU5PLkRvd25sb2FkU3RhdGlvbi5UYXNrJywgJ2RlbGV0ZScsIDEsIHBhcmFtcywgKHN1Y2Nlc3MsIGRhdGEpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5sb2FkVGFza3MoKTtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2soc3VjY2VzcywgZGF0YSk7XHJcbiAgICAgICAgfSwgJ1BPU1QnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8hUXVpY2tDb25uZWN0XHJcbiAgICBwdWJsaWMgZ2V0UXVpY2tDb25uZWN0U2VydmVycyhjYWxsYmFjazogKHN1Y2Nlc3M6IGJvb2xlYW4sIGRhdGE/OiBhbnkpID0+IHZvaWQpIHtcclxuICAgICAgICAkLmFqYXgoe1xyXG4gICAgICAgICAgICB1cmw6XHRcImh0dHBzOi8vZ2xvYmFsLnF1aWNrY29ubmVjdC50by9TZXJ2LnBocFwiLFxyXG4gICAgICAgICAgICBkYXRhOlx0SlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2ZXJzaW9uOiAxLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb21tYW5kOiBcImdldF9zaXRlX2xpc3RcIlxyXG4gICAgICAgICAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICBwcm9jZXNzRGF0YTogZmFsc2UsXHJcbiAgICAgICAgICAgIGRhdGFUeXBlOiBcImpzb25cIixcclxuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcclxuICAgICAgICAgICAgdGltZW91dDogNTAwMFxyXG4gICAgICAgICAgICBcclxuICAgICAgICB9KS5kb25lKChkYXRhKSA9PiB7XHJcbiAgICAgICAgICAgIGlmKGRhdGEuZXJybm8gIT0gMCB8fCAhZGF0YS5zaXRlcyB8fCAhQXJyYXkuaXNBcnJheShkYXRhLnNpdGVzKSB8fCBkYXRhLnNpdGVzLmxlbmd0aCA9PSAwKSB7XHJcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNhbGxiYWNrKHRydWUsIGRhdGEuc2l0ZXMpO1xyXG4gICAgICAgIH0pLmZhaWwoKCkgPT4ge1xyXG4gICAgICAgICAgICBjYWxsYmFjayhmYWxzZSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIGdldFF1aWNrQ29ubmVjdERldGFpbHMoc2VydmVyVXJsOiBzdHJpbmcsIGh0dHBzOiBib29sZWFuLCBjYWxsYmFjazogKHN1Y2Nlc3M6IGJvb2xlYW4sIGRhdGE/OiBhbnkpID0+IHZvaWQpIHtcclxuICAgICAgICAkLmFqYXgoe1xyXG4gICAgICAgICAgICB1cmw6IFwiaHR0cHM6Ly9cIiArIHNlcnZlclVybCArIFwiL1NlcnYucGhwXCIsXHJcbiAgICAgICAgICAgIGRhdGE6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgICAgICAgIHZlcnNpb246IDEsXHJcbiAgICAgICAgICAgICAgICBjb21tYW5kOiBcImdldF9zZXJ2ZXJfaW5mb1wiLFxyXG4gICAgICAgICAgICAgICAgaWQ6IGh0dHBzID8gXCJkc21faHR0cHNcIiA6IFwiZHNtXCIsIC8vIGRzbSBvciBkc21faHR0cHNcclxuICAgICAgICAgICAgICAgIHNlcnZlcklEOiB0aGlzLl9zZXR0aW5ncy5xdWlja0Nvbm5lY3RJZFxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAgZGF0YVR5cGU6IFwianNvblwiLFxyXG4gICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxyXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwXHJcbiAgICAgICAgfSkuZG9uZSgoZGF0YSkgPT4ge1xyXG4gICAgICAgICAgICBpZihkYXRhLmVycm5vICE9IDAgfHwgXHJcbiAgICAgICAgICAgICAgICAhZGF0YS5zZXJ2ZXIgfHwgIWRhdGEuc2VydmVyLmludGVyZmFjZSB8fCAhQXJyYXkuaXNBcnJheShkYXRhLnNlcnZlci5pbnRlcmZhY2UpIHx8ICFkYXRhLnNlcnZlci5leHRlcm5hbCB8fCAhZGF0YS5zZXJ2ZXIuc2VydmVySUQgfHwgXHJcbiAgICAgICAgICAgICAgICAhZGF0YS5zZXJ2aWNlIHx8IGRhdGEuc2VydmljZS5wb3J0ID09IG51bGwgfHwgZGF0YS5zZXJ2aWNlLmV4dF9wb3J0ID09IG51bGwpXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGZhbHNlKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIGludGVyZmFjZXM6IEFycmF5PGFueT4gPSBbXTtcclxuICAgICAgICAgICAgdmFyIGV6aWQgPSBtZDUoZGF0YS5zZXJ2ZXIuc2VydmVySUQpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gRGV2aWNlIG5ldHdvcmsgaW50ZXJmYWNlc1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRhdGEuc2VydmVyLmludGVyZmFjZS5sZW5ndGg7IGkrKylcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgdmFyIGludGVyZmFjZURldGFpbHMgPSBkYXRhLnNlcnZlci5pbnRlcmZhY2VbaV07XHJcbiAgICAgICAgICAgICAgICBpbnRlcmZhY2VzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgICAgIGlwOiBpbnRlcmZhY2VEZXRhaWxzLmlwLFxyXG4gICAgICAgICAgICAgICAgICAgIHBvcnQ6IGRhdGEuc2VydmljZS5wb3J0LFxyXG4gICAgICAgICAgICAgICAgICAgIGV6aWQ6IGV6aWRcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgZXh0ZXJuYWxQb3J0ID0gZGF0YS5zZXJ2aWNlLmV4dF9wb3J0ID09PSAwID8gZGF0YS5zZXJ2aWNlLnBvcnQgOiBkYXRhLnNlcnZpY2UuZXh0X3BvcnQ7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBDdXN0b20gRE5TXHJcbiAgICAgICAgICAgIGlmKGRhdGEuc2VydmVyLmZxZG4pXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIGludGVyZmFjZXMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgaXA6IGRhdGEuc2VydmVyLmZxZG4ucmVwbGFjZSgvJy9nLFwiXCIpLCAvL3JlcGxhY2UgJyBpbiB0aGUgcmV0dXJuZWQgZGRucyBzdHJpbmdcclxuICAgICAgICAgICAgICAgICAgICBwb3J0OiBleHRlcm5hbFBvcnQsXHJcbiAgICAgICAgICAgICAgICAgICAgZXppZDogZXppZFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIERETlNcclxuICAgICAgICAgICAgaWYoZGF0YS5zZXJ2ZXIuZGRucylcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgaW50ZXJmYWNlcy5wdXNoKHtcclxuICAgICAgICAgICAgICAgICAgICBpcDogZGF0YS5zZXJ2ZXIuZGRucy5yZXBsYWNlKC8nL2csXCJcIiksIC8vcmVwbGFjZSAnIGluIHRoZSByZXR1cm5lZCBkZG5zIHN0cmluZ1xyXG4gICAgICAgICAgICAgICAgICAgIHBvcnQ6IGV4dGVybmFsUG9ydCxcclxuICAgICAgICAgICAgICAgICAgICBlemlkOiBlemlkXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gUHVibGljIElQXHJcbiAgICAgICAgICAgIGludGVyZmFjZXMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICBpcDogZGF0YS5zZXJ2ZXIuZXh0ZXJuYWwuaXAsXHJcbiAgICAgICAgICAgICAgICBwb3J0OiBleHRlcm5hbFBvcnQsXHJcbiAgICAgICAgICAgICAgICBlemlkOiBlemlkXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY2FsbGJhY2sodHJ1ZSwgaW50ZXJmYWNlcyk7XHJcbiAgICAgICAgfSkuZmFpbCgoKSA9PiB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrKGZhbHNlKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcHVibGljIHBpbmdEaXNrU3RhdGlvbihodHRwczogYm9vbGVhbiwgaXA6IHN0cmluZywgcG9ydDogbnVtYmVyLCBjYWxsYmFjazogKHN1Y2Nlc3M6IGJvb2xlYW4sIGV6aWQ/OiBzdHJpbmcpID0+IHZvaWQpIHtcclxuICAgICAgICB2YXIgdXJsID0gKGh0dHBzID8gXCJodHRwczovL1wiIDogXCJodHRwOi8vXCIpICsgaXAgKyBcIjpcIiArIHBvcnQgKyBcIi93ZWJtYW4vcGluZ3BvbmcuY2dpXCI7XHJcbiAgICAgICAgXHJcbiAgICAgICAgJC5hamF4KHtcclxuICAgICAgICAgICAgdXJsOiB1cmwsXHJcbiAgICAgICAgICAgIGRhdGFUeXBlOiBcImpzb25cIixcclxuICAgICAgICAgICAgdGltZW91dDogMjAwMDAsIC8vIFNob3VsZCBiZSBlbm91Z2ggdGltZSBmb3IgdGhlIGRldmljZSB0byB3YWtlIHVwIGZyb20gc2xlZXBcclxuICAgICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXHJcbiAgICAgICAgfSkuZG9uZSgoZGF0YSkgPT4ge1xyXG4gICAgICAgICAgICBpZihkYXRhLnN1Y2Nlc3MgIT09IHRydWUpIHtcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGZhbHNlKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYoZGF0YS5ib290X2RvbmUgIT09IHRydWUpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiRGV2aWNlIG9uIHVybCAnJXMnIGhhcyBub3QgZmluaXNoZWQgYm9vdGluZy5cIiwgdXJsKTtcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGZhbHNlKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNhbGxiYWNrKHRydWUsIGRhdGEuZXppZCk7XHJcbiAgICAgICAgfSkuZmFpbCgoKSA9PiB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrKGZhbHNlKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgZ2V0UXVpY2tDb25uZWN0U2V0dGluZ3MoY2FsbGJhY2s6IChzdWNjZXNzOiBib29sZWFuLCBkYXRhOiBhbnkpID0+IHZvaWQpXHJcbiAgICB7XHJcbiAgICAgICAgdmFyIHJlcXVpcmVIdHRwcyA9IHRydWU7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5nZXRRdWlja0Nvbm5lY3RTZXJ2ZXJzKChzdWNjZXNzLCBzZXJ2ZXJzKSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChzdWNjZXNzID09IGZhbHNlIHx8IHNlcnZlcnMubGVuZ3RoID09IDApXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGZhbHNlLCBcInF1aWNrQ29ubmVjdE1haW5TZXJ2ZXJVbmF2YWlsYWJsZVwiKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIGZpbmlzaGVkUmVxdWVzdENvdW50ID0gMDtcclxuICAgICAgICAgICAgdmFyIHJlc3VsdEZvdW5kID0gZmFsc2U7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgcGluZ0ludGVyZmFjZXMgPSAoaW50ZXJmYWNlczogQXJyYXk8YW55PiwgcGluZ0NhbGxiYWNrOiAoc3VjY2VzczogYm9vbGVhbiwgZGF0YT86IGFueSkgPT4gdm9pZCkgPT5cclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgdmFyIGZpbmlzaGVkUGluZ0NvdW50ID0gMDtcclxuICAgICAgICAgICAgICAgIHZhciBwaW5nUmVzcG9uc2VGb3VuZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAkLmVhY2goaW50ZXJmYWNlcywgKGluZGV4LCBjdXJyZW50SW50ZXJmYWNlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5waW5nRGlza1N0YXRpb24ocmVxdWlyZUh0dHBzLCBjdXJyZW50SW50ZXJmYWNlLmlwLCBjdXJyZW50SW50ZXJmYWNlLnBvcnQsIChzdWNjZXNzLCBlemlkKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbmlzaGVkUGluZ0NvdW50Kys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZihwaW5nUmVzcG9uc2VGb3VuZClcclxuICAgICAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsaWRFemlkID0gKGV6aWQgPT0gY3VycmVudEludGVyZmFjZS5lemlkKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKChzdWNjZXNzID09IGZhbHNlIHx8IHZhbGlkRXppZCA9PSBmYWxzZSkgJiYgZmluaXNoZWRQaW5nQ291bnQgPT0gaW50ZXJmYWNlcy5sZW5ndGgpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE5vIHZhbGlkIHBpbmcgZm9yIGFueSBvZiB0aGUgaW50ZXJmYWNlc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGluZ0NhbGxiYWNrKGZhbHNlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYoc3VjY2VzcyAmJiB2YWxpZEV6aWQpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBpbmdSZXNwb25zZUZvdW5kID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBpbmdDYWxsYmFjayh0cnVlLCBjdXJyZW50SW50ZXJmYWNlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAkLmVhY2goc2VydmVycywgKGluZGV4LCBjdXJyZW50U2VydmVyKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmdldFF1aWNrQ29ubmVjdERldGFpbHMoY3VycmVudFNlcnZlciwgcmVxdWlyZUh0dHBzLCAoc3VjY2VzczogYm9vbGVhbiwgaW50ZXJmYWNlczogQXJyYXk8YW55PikgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGZpbmlzaGVkUmVxdWVzdENvdW50Kys7XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgaWYocmVzdWx0Rm91bmQpe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIGlmKHN1Y2Nlc3MgPT0gZmFsc2UgJiYgZmluaXNoZWRSZXF1ZXN0Q291bnQgPT0gc2VydmVycy5sZW5ndGgpXHJcbiAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBBbGwgc2VydmVycyBjaGVja2VkIGJ1dCBubyB2YWxpZCByZXN1bHRcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZmFsc2UsIFwicXVpY2tDb25uZWN0SW5mb3JtYXRpb25Ob3RGb3VuZFwiKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICBpZihzdWNjZXNzKVxyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVGhpcyBpcyB0aGUgZmlyc3QgcmVxdWVzdCB0aGF0IHJldHVybmVkIGEgcmVzdWx0LCB1c2UgdGhpcyBvbmVcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0Rm91bmQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGluZ0ludGVyZmFjZXMoaW50ZXJmYWNlcywgKHN1Y2Nlc3MsIGNvbm5lY3Rpb25EZXRhaWxzKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihzdWNjZXNzKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKHRydWUsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXJsOiBjb25uZWN0aW9uRGV0YWlscy5pcCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9ydDogY29ubmVjdGlvbkRldGFpbHMucG9ydCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvdG9jb2w6IHJlcXVpcmVIdHRwcyA/IFwiaHR0cHM6Ly9cIiA6IFwiaHR0cDovL1wiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBUcnkgUXVpY2tDb25uZWN0IHR1bm5lbFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXF1ZXN0UXVpY2tDb25uZWN0UmVsYXkoY3VycmVudFNlcnZlciwgKHN1Y2Nlc3M6IGJvb2xlYW4sIGRhdGE6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soc3VjY2VzcywgZGF0YSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhzdWNjZXNzLCBcInF1aWNrQ29ubmVjdFR1bm5lbEZhaWxlZFwiKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgcmVxdWVzdFF1aWNrQ29ubmVjdFJlbGF5KHNlcnZlclVybDogc3RyaW5nLCBjYWxsYmFjazogKHN1Y2Nlc3M6IGJvb2xlYW4sIGRhdGE/OiBhbnkpID0+IHZvaWQpIHtcclxuICAgICAgICB2YXIgc2VydmVyQ29kZSA9IHNlcnZlclVybC5zcGxpdChcIi5cIilbMF07XHJcbiAgICAgICAgXHJcbiAgICAgICAgJC5hamF4KHtcclxuICAgICAgICAgICAgdXJsOiBcImh0dHBzOi8vXCIgKyBzZXJ2ZXJVcmwgKyBcIi9TZXJ2LnBocFwiLFxyXG4gICAgICAgICAgICBkYXRhOiBKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgICAgICAgICAgICB2ZXJzaW9uOiAxLFxyXG4gICAgICAgICAgICAgICAgY29tbWFuZDogXCJyZXF1ZXN0X3R1bm5lbFwiLFxyXG4gICAgICAgICAgICAgICAgaWQ6IFwiZHNtX2h0dHBzXCIsIC8vIGRzbSBvciBkc21faHR0cHNcclxuICAgICAgICAgICAgICAgIHNlcnZlcklEOiB0aGlzLl9zZXR0aW5ncy5xdWlja0Nvbm5lY3RJZFxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAgZGF0YVR5cGU6IFwianNvblwiLFxyXG4gICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxyXG4gICAgICAgICAgICB0aW1lb3V0OiAzMDAwMFxyXG4gICAgICAgIH0pLmRvbmUoKGRhdGEpID0+IHtcclxuICAgICAgICAgICAgaWYoZGF0YS5lcnJubyAhPSAwIHx8IGRhdGEuZXJybm8gPT0gdW5kZWZpbmVkIHx8ICFkYXRhLnNlcnZlciB8fCAhZGF0YS5zZXJ2ZXIuZXh0ZXJuYWwgfHwgXHJcbiAgICAgICAgICAgICAgICAhZGF0YS5zZXJ2ZXIuc2VydmVySUQgfHwgIWRhdGEuc2VydmljZSB8fCBkYXRhLnNlcnZpY2UucG9ydCA9PSBudWxsIHx8IGRhdGEuc2VydmljZS5leHRfcG9ydCA9PSBudWxsKVxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBob3N0bmFtZSA9IHRoaXMuX3NldHRpbmdzLnF1aWNrQ29ubmVjdElkICsgXCIuXCIgKyBzZXJ2ZXJDb2RlLnNsaWNlKDAsIDIpICsgXCIucXVpY2tjb25uZWN0LnRvXCI7XHJcbiAgICAgICAgICAgIHZhciBwb3J0ID0gZGF0YS5zZXJ2aWNlLmh0dHBzX3BvcnQgPyBkYXRhLnNlcnZpY2UuaHR0cHNfcG9ydCA6IDQ0MztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMucGluZ0Rpc2tTdGF0aW9uKHRydWUsIGhvc3RuYW1lLCBwb3J0LCAoc3VjY2VzcywgZXppZCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYoc3VjY2VzcyA9PSBmYWxzZSB8fCBlemlkICE9IG1kNShkYXRhLnNlcnZlci5zZXJ2ZXJJRCkpXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKHRydWUsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdXJsOiBob3N0bmFtZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcG9ydDogcG9ydCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvdG9jb2w6IFwiaHR0cHM6Ly9cIlxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgfSkuZmFpbCgoKSA9PiB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrKGZhbHNlKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIHNlY29uZHNUb1N0ciAoczogbnVtYmVyKSB7XHJcblx0XHJcbiAgICBmdW5jdGlvbiBudW1iZXJFbmRpbmcgKG46IG51bWJlcikge1xyXG4gICAgICAgIHJldHVybiAobiA+IDEpID8gJ3MnIDogJyc7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHRlbXAgPSBzO1xyXG4gICAgdmFyIHRpbWVQYXJ0cyA9IG5ldyBBcnJheTxzdHJpbmc+KCk7XHJcbiAgICBcclxuICAgIHZhciB5ZWFycyA9IE1hdGguZmxvb3IodGVtcCAvIDMxNTM2MDAwKTtcclxuICAgIGlmICh5ZWFycykge1xyXG4gICAgXHR0aW1lUGFydHMucHVzaCh5ZWFycyArIFwiIHlcIik7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHZhciBkYXlzID0gTWF0aC5mbG9vcigodGVtcCAlPSAzMTUzNjAwMCkgLyA4NjQwMCk7XHJcbiAgICBpZiAoZGF5cykge1xyXG4gICAgXHR0aW1lUGFydHMucHVzaChkYXlzICsgXCIgZFwiKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgaG91cnMgPSBNYXRoLmZsb29yKCh0ZW1wICU9IDg2NDAwKSAvIDM2MDApO1xyXG4gICAgaWYgKGhvdXJzKSB7XHJcbiAgICBcdHRpbWVQYXJ0cy5wdXNoKGhvdXJzICsgXCIgaFwiKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgbWludXRlcyA9IE1hdGguZmxvb3IoKHRlbXAgJT0gMzYwMCkgLyA2MCk7XHJcbiAgICBpZiAobWludXRlcykge1xyXG4gICAgXHR0aW1lUGFydHMucHVzaChtaW51dGVzICsgXCIgbVwiKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgc2Vjb25kcyA9IE1hdGgucm91bmQodGVtcCAlIDYwKTtcclxuICAgIGlmIChzZWNvbmRzKSB7XHJcbiAgICBcdHRpbWVQYXJ0cy5wdXNoKHNlY29uZHMgKyBcIiBzXCIpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBpZih0aW1lUGFydHMubGVuZ3RoID49IDIpXHJcbiAgICBcdHJldHVybiB0aW1lUGFydHNbMF0gKyBcIiBcIiArIHRpbWVQYXJ0c1sxXTtcclxuICAgIGVsc2UgaWYodGltZVBhcnRzLmxlbmd0aCA9PSAxKVxyXG4gICAgXHRyZXR1cm4gdGltZVBhcnRzWzBdO1xyXG4gICAgZWxzZVxyXG4gICAgXHRyZXR1cm4gJ2xlc3MgdGhhbiBhIHNlY29uZCc7IC8vJ2p1c3Qgbm93JyAvL29yIG90aGVyIHN0cmluZyB5b3UgbGlrZTtcclxufVxyXG5cdFxyXG5mdW5jdGlvbiBnZXRHTVRPZmZzZXQoZGF0ZTogRGF0ZSkge1xyXG4gICAgcmV0dXJuIChkYXRlLmdldFRpbWV6b25lT2Zmc2V0KCkgPiAwID8gXCItXCIgOiBcIitcIikgKyBcclxuICAgICAgICBsZWZ0UGFkKE1hdGguZmxvb3IoTWF0aC5hYnMoZGF0ZS5nZXRUaW1lem9uZU9mZnNldCgpKSAvIDYwKSwgMiwgXCIwXCIpICtcclxuICAgICAgICBcIjpcIiArXHJcbiAgICAgICAgbGVmdFBhZChNYXRoLmFicyhkYXRlLmdldFRpbWV6b25lT2Zmc2V0KCkgJSA2MCksIDIsIFwiMFwiKTtcclxufVxyXG5cdFxyXG5mdW5jdGlvbiBsZWZ0UGFkKGQ6IG51bWJlciwgYjogbnVtYmVyLCBjOiBzdHJpbmcpIHtcclxuICAgIHZhciBhPVN0cmluZyhkKTtcclxuICAgIGlmKCFjKSB7XHJcbiAgICAgICAgYz1cIiBcIjtcclxuICAgIH1cclxuICAgIFxyXG4gICAgd2hpbGUoYS5sZW5ndGg8Yikge1xyXG4gICAgICAgIGE9YythXHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIGE7XHJcbn0iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=

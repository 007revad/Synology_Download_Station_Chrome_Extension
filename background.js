// Manifest V3 Service Worker - Synology Download Station
try {
    console.log('[SW] Starting...');
    
    // Load MV3 ajax shim FIRST
    importScripts('js/ajax-shim.js');
    
    // Force $ to be available globally
    if (typeof self !== 'undefined' && !self.$) self.$ = globalThis.$;
    
    // Load non-DOM libraries only
    importScripts('js/lib/prototype-extensions.js');
    importScripts('js/lib/encryption.js');
    importScripts('js/lib/md5.js');
    
    importScripts('js/variables.js');
    importScripts('js/browser-functions.js');
    
    // Load base class BEFORE API that extends it
    importScripts('js/downloadstation.js');
    importScripts('js/downloadstation-api.js');
    importScripts('js/filestation-api.js');
    
    let downloadStation = null;
    let initPromise = null;
    let updateTimeoutId = null;
    let latestTag = null;
    let latestVersion = null;
    
    // Update toolbar icon based on connection status
    function updateToolbarIcon() {
        if (downloadStation && downloadStation.connected && downloadStation.deviceInfo && downloadStation.deviceInfo.loggedIn) {
            console.log('[SW] Updating icon to CONNECTED');
            chrome.action.setIcon({ 
                path: { 
                    '19': 'images/Icon-19.png', 
                    '38': 'images/Icon-38.png' 
                } 
            });
        } else {
            console.log('[SW] Updating icon to DISCONNECTED');
            chrome.action.setIcon({ 
                path: { 
                    '19': 'images/Icon-19-disconnected.png', 
                    '38': 'images/Icon-38-disconnected.png' 
                } 
            });
        }
    }
    
    // Get latest GitHub release version number
    function getLatestVersion() {
        if (latestVersion != null) {
            return Promise.resolve(latestVersion);
        }
        
        return fetch('https://api.github.com/repos/007revad/Synology_Download_Station_Chrome_Extension/releases/latest')
        .then((response) => response.json())
        .then((data) => {
            latestVersion = data.tag_name;
            console.log('Latest GitHub Release Tag:', latestVersion);
            chrome.storage.local.set({ latestVersion: latestVersion });
            return latestVersion;
        })
        .catch((error) => {
            console.error('Error fetching latest release version:', error);
            return null;
        });
    }
    
    // Create or clear alarm to keep SW alive
    function setKeepaliveAlarm() {
        chrome.alarms.clear('keepalive', () => {
            // Set alarm for 25 seconds (under MV3 5-min limit)
            chrome.alarms.create('keepalive', { periodInMinutes: 0.42 }); // ~25 seconds
            console.log('[SW] Keepalive alarm set');
        });
    }
    
    // Function to periodically update tasks
    function scheduleTaskUpdate() {
        if (updateTimeoutId) {
            clearTimeout(updateTimeoutId);
        }
        
        updateTimeoutId = setTimeout(() => {
            if (downloadStation && downloadStation.connected) {
                console.log('[SW] Periodic task update...');
                downloadStation.loadTasks((success, data) => {
                    console.log('[SW] Task update complete:', success, downloadStation.tasks ? downloadStation.tasks.length : 0, 'tasks');
                    if (success) {
                        updateToolbarIcon();
                    } else {
                        console.warn('[SW] Task update failed - marking as disconnected');
                        downloadStation.connected = false;
                        updateToolbarIcon();
                        // Force reconnection on next cycle
                        scheduleTaskUpdate();
                        return;
                    }
                    scheduleTaskUpdate();
                });
            } else {
                console.log('[SW] Not connected, attempting reconnection...');
                downloadStation.loadTasks((success, data) => {
                    console.log('[SW] Reconnection attempt:', success);
                    if (success) {
                        updateToolbarIcon();
                    }
                    scheduleTaskUpdate();
                });
            }
        }, 12000); // 12 seconds
    }
    
    // Initialize downloadStation with error handling
    function initializeDownloadStation() {
        if (initPromise) return initPromise;
        
        initPromise = new Promise((resolve) => {
            chrome.storage.local.get(null, (items) => {
                console.log('[SW] Settings loaded:', items ? Object.keys(items) : 'empty');
                try {
                    downloadStation = new DownloadStationAPI(items || {});
                    console.log('[SW] DownloadStationAPI initialized successfully');
                    resolve(true);
                } catch (e) {
                    console.error('[SW] Init error:', e.message, e.stack);
                    resolve(false);
                }
            });
        });
        
        return initPromise;
    }
    
    // Initialize on load
    initializeDownloadStation().then(() => {
        // Trigger initial connection/task load
        if (downloadStation) {
            console.log('[SW] Triggering initial connection...');
            downloadStation.loadTasks((success, data) => {
                console.log('[SW] Initial connection attempt:', success);
                updateToolbarIcon();
            });
        }
        updateToolbarIcon();
        scheduleTaskUpdate();
        setKeepaliveAlarm();
        // Set up daily version check alarm
        chrome.alarms.create('dailyVersionCheck', { periodInMinutes: 24 * 60 }); // Every 24 hours
        // Fetch latest version on startup
        getLatestVersion();
    });
    
    // Handle alarms
    chrome.alarms.onAlarm.addListener((alarm) => {
        // Handle keepalive alarm
        if (alarm.name === 'keepalive') {
            console.log('[SW] Keepalive alarm fired - SW staying alive');
            if (downloadStation && downloadStation.connected) {
                downloadStation.loadTasks(() => {
                    console.log('[SW] Keepalive task update done');
                    updateToolbarIcon();
                });
            }
            setKeepaliveAlarm(); // Reschedule
        }
        // Handle the daily version check alarm
        if (alarm.name === 'dailyVersionCheck') {
            console.log('[SW] Daily version check - clearing cache and fetching latest');
            chrome.storage.local.remove('latestVersion', () => {
                latestVersion = null; // Clear local variable too
                getLatestVersion();
            });
        }
    });
    
    function registerMessageHandler() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('[SW] Message received:', request.action);
            
            // Ensure downloadStation is initialized before handling message
            if (!downloadStation) {
                console.log('[SW] SW not initialized, initializing now...');
                initializeDownloadStation().then(() => {
                    handleMessage(request, sendResponse);
                }).catch((err) => {
                    console.error('[SW] Init error:', err);
                    sendResponse({ success: false, message: 'Initialization failed' });
                });
            } else {
                handleMessage(request, sendResponse);
            }
            
            // Always return true to indicate async response
            return true;
        });
    }
    
    function handleMessage(request, sendResponse) {
        try {
            switch(request.action) {
                case 'ping':
                    console.log('[SW] Ping received - SW is alive');
                    sendResponse({ success: true, message: 'SW alive' });
                    break;
                    
                case 'getLatestVersion':
                    getLatestVersion().then((version) => {
                        sendResponse(version);
                    });
                    return true; // Async
                    
                case 'testConnection':
                    if (!downloadStation) {
                        console.error('[SW] testConnection: downloadStation not initialized');
                        sendResponse({ success: false, message: 'Not initialized' });
                        return;
                    }
                    if (request.data) {
                        console.log('[SW] Updating settings:', Object.keys(request.data));
                        downloadStation._settings = Object.assign(downloadStation._settings, request.data);
                    }
                    console.log('[SW] Calling getDsmVersion...');
                    downloadStation.getDsmVersion((success, data) => {
                        console.log('[SW] getDsmVersion callback:', success, data);
                        try {
                            if (success) {
                                updateToolbarIcon();
                            }
                            sendResponse({ success: success, message: success ? 'Connected' : 'Failed', data: data });
                        } catch (e) {
                            console.error('[SW] Error sending response:', e.message);
                        }
                    });
                    return true; // Async
                    
                case 'deleteTask':
                    if (!downloadStation) {
                        sendResponse({ success: false, message: 'Not connected' });
                        return;
                    }
                    console.log('[SW] Deleting task:', request.data);
                    downloadStation.deleteTask(request.data, function(success, data) {
                        sendResponse({ success: success, data: data });
                    });
                    return true; // Async
                    
                case 'saveConnectionSettings':
                    chrome.storage.local.set(request.data, () => {
                        console.log('[SW] Connection settings saved');
                        if (downloadStation) {
                            downloadStation._settings = Object.assign(downloadStation._settings, request.data);
                        }
                        sendResponse({ success: true, message: 'Saved' });
                    });
                    return true; // Async
                    
                case 'saveOtherSettings':
                    chrome.storage.local.set(request.data, () => {
                        console.log('[SW] Other settings saved');
                        if (downloadStation) {
                            downloadStation._settings = Object.assign(downloadStation._settings, request.data);
                        }
                        sendResponse({ success: true, message: 'Saved' });
                    });
                    return true; // Async
                    
                case 'getSettings':
                    chrome.storage.local.get(null, (items) => {
                        console.log('[SW] Returning settings');
                        sendResponse(items || {});
                    });
                    return true; // Async
                
                case 'getDeviceInfo':
                    if (!downloadStation) {
                        sendResponse(null);
                        return;
                    }
                    console.log('[SW] Returning device info');
                    sendResponse(downloadStation.deviceInfo || {});
                    break;
                
                case 'getTasks':
                    if (!downloadStation) {
                        sendResponse([]);
                        return;
                    }
                    console.log('[SW] Returning tasks, count:', downloadStation.tasks ? downloadStation.tasks.length : 0);
                    sendResponse(downloadStation.tasks || []);
                    break;
                
                case 'pauseTask':
                    if (!downloadStation) {
                        sendResponse({ success: false, message: 'Not connected' });
                        return;
                    }
                    console.log('[SW] Pausing tasks:', request.data);
                    downloadStation.pauseTask(request.data, function(success, data) {
                        sendResponse({ success: success, data: data });
                    });
                    return true; // Async
                
                case 'resumeTask':
                    if (!downloadStation) {
                        sendResponse({ success: false, message: 'Not connected' });
                        return;
                    }
                    console.log('[SW] Resuming tasks:', request.data);
                    downloadStation.resumeTask(request.data, function(success, data) {
                        sendResponse({ success: success, data: data });
                    });
                    return true; // Async
                
                case 'clearFinishedTasks':
                    if (!downloadStation) {
                        sendResponse({ success: false, message: 'Not connected' });
                        return;
                    }
                    console.log('[SW] Clearing finished tasks');
                    downloadStation.clearFinishedTasks(function(success, data) {
                        sendResponse({ success: success, data: data });
                    });
                    return true; // Async
                
                case 'listFolders':
                    if (!downloadStation) {
                        sendResponse({ success: false, message: 'Not initialized' });
                        return;
                    }
                    downloadStation.fileStation.listFolders(request.data, (success, data) => {
                        sendResponse({ success: success, data: data });
                    });
                    return true; // Async
                    
                case 'addTask':
                    if (!downloadStation) {
                        sendResponse({ success: false, data: 'couldNotConnect' });
                        return;
                    }
                    console.log('[SW] Adding task with URL:', request.data.url);
                    downloadStation.createTask(request.data.url, request.data.username, request.data.password, 
                        request.data.unzipPassword, request.data.destinationFolder, (success, data) => {
                        console.log('[SW] addTask callback:', success, data);
                        sendResponse({ success: success, data: data });
                    });
                    return true; // Async
                
                case 'settingChanged':
                    console.log('[SW] Setting changed:', request.setting, '=', request.value);
                    if (request.setting === 'hideSeedingTorrents') {
                        console.log('[SW] hideSeedingTorrents changed to:', request.value);
                        // Reload tasks from Download Station to apply filter
                        if (downloadStation && downloadStation.connected) {
                            downloadStation.loadTasks((success, data) => {
                                console.log('[SW] Tasks reloaded after hideSeedingTorrents change');
                                updateToolbarIcon();
                                sendResponse({ success: true, message: 'Tasks reloaded' });
                            });
                            return true; // Async
                        }
                    }
                    sendResponse({ success: true, message: 'Setting change acknowledged' });
                    break;
                    
                default:
                    console.warn('[SW] Unknown action:', request.action);
                    sendResponse({ success: false, message: 'Unknown action' });
            }
        } catch (error) {
            console.error('[SW] Message handler error:', error.message, error.stack);
            sendResponse({ success: false, message: error.message });
        }
    }
    
    registerMessageHandler();
    console.log('[SW] Ready');
    
} catch (error) {
    console.error('[SW] Fatal error:', error.message, error.stack);
}

// When the extension is first installed, open the options page in a new tab
chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === 'install') {
        chrome.tabs.create({
            url: "options.html"
        });
    }
});
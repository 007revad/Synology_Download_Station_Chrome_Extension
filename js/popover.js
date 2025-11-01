/// <reference path="../../typings/index.d.ts"/>

console.log('[Popover] popover.js loading - STEP 1');

// DEFINE BYTESTOSTRING FIRST - before anything else that might use it
function bytesToString(bytes) {
    bytes = parseInt(bytes);
    var KILOBYTE = 1024;
    var MEGABYTE = KILOBYTE * 1024;
    var GIGABYTE = MEGABYTE * 1024;
    var TERABYTE = GIGABYTE * 1024;

    if (isNaN(bytes)) {
        return "0 B";
    } 
    if (bytes < KILOBYTE) {
        return Math.round(bytes * 100) / 100 + ' B';
    } else if (bytes < MEGABYTE) {
        return Math.round(bytes / KILOBYTE * 100) / 100 + ' KB';
    } else if (bytes < GIGABYTE) {
        return Math.round(bytes / MEGABYTE * 100) / 100 + ' MB';
    } else if (bytes < TERABYTE) {
        return Math.round(bytes / GIGABYTE * 100) / 100 + ' GB';
    } else {
        return Math.round(bytes / TERABYTE * 100) / 100 + ' TB';
    }
}

console.log('[Popover] bytesToString defined - STEP 2');

var textDirection = "ltr";

window.addEventListener('load', function load() {
    window.removeEventListener('load', load, false);
    document.body.classList.remove('load');
}, false);

var popoverVisible = false;
var popoverUpdateInterval = null;
var currentTasks = [];

console.log('[Popover] Variables initialized - STEP 3');

function updateUIButtons() {
    console.log('[Popover] updateUIButtons() called');
    
    if (typeof viewModel === 'undefined') {
        console.warn('[Popover] ⚠️ WARNING: viewModel undefined in updateUIButtons!');
        return;
    }
    
    console.log('[Popover] Updating UI buttons - configured:', viewModel.downloadStationConfigured(), 'loggedIn:', viewModel.loggedIn());
    
    // ALWAYS show add-task and open-webui buttons regardless of connection state
    $('#add-task-btn').show();
    $('#open-webui').show();
    
    // Only show pause/resume/clear based on actual task states
    var hasPauseable = false;
    var hasResumeable = false;
    
    for (var i = 0; i < currentTasks.length; i++) {
        var task = currentTasks[i];
        if (task.status && (task.status === 'downloading' || task.status === 'waiting')) {
            hasPauseable = true;
        }
        if (task.status && (task.status === 'paused' || task.status === 'finished')) {
            hasResumeable = true;
        }
    }
    
    hasPauseable ? $('#pause-all').show() : $('#pause-all').hide();
    hasResumeable ? $('#resume-all').show() : $('#resume-all').hide();
    
    var hasFinished = currentTasks.some(function(t) { return t.status === 'finished'; });
    hasFinished ? $('#clear-finished').show() : $('#clear-finished').hide();
}

function updateDeviceInfo(info) {
    console.log('[Popover] updateDeviceInfo() called with:', info);
    
    if (info !== null && info !== undefined && info.deviceName) {
        console.log('[Popover] ✓ Device info VALID - showing main container');
        console.log('[Popover] Device name:', info.deviceName);
        
        $('#device-name').text(info.deviceName);
        $('#no-connection').hide();
        $('#main-container').show();
        $('#footer').show();
        
        if (typeof viewModel !== 'undefined') {
            console.log('[Popover] Setting viewModel properties...');
            viewModel.deviceName(info.deviceName);
            viewModel.dsmVersion(info.dsmVersion);
            viewModel.dsmVersionString(info.dsmVersionString);
            viewModel.fullUrl(info.fullUrl);
            viewModel.loggedIn(info.loggedIn);
            viewModel.downloadStationConfigured(true);
            viewModel.statusMessage(info.status);
        }
        
        updateUIButtons();
    }
    else {
        console.log('[Popover] ✗ Device info INVALID/NULL - showing no-connection message');
        $('#no-connection').show();
        $('#main-container').hide();
        $('#footer').hide();
        
        if (typeof viewModel !== 'undefined') {
            viewModel.downloadStationConfigured(false);
        }
    }
}

function updateTasks(tasks) {
    console.log('[Popover] updateTasks() called with:', tasks ? tasks.length + ' tasks' : 'null');
    
    currentTasks = tasks || [];
    
    if (!popoverVisible || !tasks || tasks.length === 0) {
        console.log('[Popover] No tasks to display');
        $('#tasks-list').empty();
        $('#no-tasks').show();
        $('#footer').hide();
        updateUIButtons();
        return;
    }
    
    console.log('[Popover] Displaying', tasks.length, 'tasks');
    $('#no-tasks').hide();
    $('#footer').show();
    
    // Manually render tasks to DOM (no Knockout due to CSP)
    try {
        var taskListHtml = '';
        
        for (var i = 0; i < tasks.length; i++) {
            var task = tasks[i];
            
            // Skip seeding tasks if hideSeedingTorrents is enabled
            if (typeof viewModel !== 'undefined' && viewModel.hideSeedingTorrents && 
                viewModel.hideSeedingTorrents() && task.status === 'seeding') {
                console.log('[Popover] Skipping seeding task:', task.id);
                continue;
            }
            
            var escapedTitle = $('<div/>').text(task.title).html();
            
            // Calculate progress percentage
            var progress = task.size > 0 ? Math.round((task.sizeDownloaded / task.size) * 100) : 0;
            
            // Determine progress bar color based on status
//            var barColor = '#0275d8'; // default blue for downloading
//            if (task.status === 'seeding') {
//                barColor = '#28a745'; // green for seeding
//            }
            var barColor = '#0275d8'; // default blue for downloading
            //var barColor = '';
            if (task.status === 'seeding') {
                barColor = '#28a745'; // green for seeding
            } else if (task.status === 'waiting') {
                barColor = ''; // null for waiting
            } else if (task.status === 'finished') {
                barColor = '#d3d3d3'; // light grey for finished
            } else if (task.status === 'error') {
                barColor = '#ff0000'; // red for error
            }
            
            // Determine which buttons to show
            var showPause = (task.status === 'downloading' || task.status === 'waiting' || task.status === 'seeding');
            var showResume = (task.status === 'paused' || task.status === 'error');
            
            // Determine speed display based on status
            var speedDisplay = '';
            if (task.status === 'downloading' || task.status === 'waiting' || task.status === 'finishing') {
                speedDisplay = 'Downloading ' + task.speedDownloadString;
            } else if (task.status === 'seeding') {
                speedDisplay = 'Seeding ' + task.speedUploadString;
            } else if (task.status === 'finished') {
                speedDisplay = 'Finished';
            } else if (task.status === 'paused') {
                speedDisplay = 'Paused';
            } else if (task.status === 'error') {
                speedDisplay = 'Error!';
            }
            
            taskListHtml += '<li data-task-id="' + task.id + '">' +
                '<span class="task-name">' + escapedTitle + '</span>' +
                '<div class="task-progress">' +
                    '<div class="progress">' +
                        '<div class="progress-bar" style="width: ' + progress + '%; background-color: ' + barColor + ';"></div>' +
                    '</div>' +
                '</div>' +
                '<div style="display: flex; justify-content: space-between; align-items: center;">' +
                    '<div>' +
                        '<div class="task-info" style="margin: 4px 0;">' +
                            '<span class="task-size">' + task.sizeDownloadedString + ' / ' + task.sizeString + '</span>' +
                            (speedDisplay ? ' - <span>' + speedDisplay + '</span>' : '') +
                        '</div>' +
                    '</div>' +
                    '<div class="task-buttons" style="display: inline-flex; gap: 8px;">' +
                        (showPause ? '<i class="fa fa-fw fa-pause task-pause-btn" role="button" title="Pause" style="cursor: pointer;"></i>' : '') +
                        (showResume ? '<i class="fa fa-fw fa-play task-resume-btn" role="button" title="Resume" style="cursor: pointer;"></i>' : '') +
                        '<i class="fa fa-fw fa-trash task-delete-btn" role="button" title="Delete" style="cursor: pointer;"></i>' +
                    '</div>' +
                '</div>' +
                '</li>';
            console.log('[Popover] Added task:', task.id, task.title);
        }
        
        // Render to DOM
        $('#tasks-list').html(taskListHtml);
        
        // Attach click handlers to buttons
        $('#tasks-list').on('click', '.task-pause-btn', function() {
            var taskId = $(this).closest('li').data('task-id');
            console.log('[Popover] Pause clicked for task:', taskId);
            chrome.runtime.sendMessage({action: "pauseTask", data: [taskId]}, function(response) {
                console.log('[Popover] Pause response:', response);
                updatePopoverData();
            });
        });
        
        $('#tasks-list').on('click', '.task-resume-btn', function() {
            var taskId = $(this).closest('li').data('task-id');
            console.log('[Popover] Resume clicked for task:', taskId);
            chrome.runtime.sendMessage({action: "resumeTask", data: [taskId]}, function(response) {
                console.log('[Popover] Resume response:', response);
                updatePopoverData();
            });
        });
        
        $('#tasks-list').on('click', '.task-delete-btn', function() {
            var taskId = $(this).closest('li').data('task-id');
            console.log('[Popover] Delete clicked for task:', taskId);
            chrome.runtime.sendMessage({action: "deleteTask", data: taskId}, function(response) {
                console.log('[Popover] Delete response:', response);
                updatePopoverData();
            });
        });
        
        console.log('[Popover] ✓ All', tasks.length, 'tasks rendered');
    } catch (e) {
        console.error('[Popover] Error rendering tasks:', e.message);
        console.error('[Popover] Stack:', e.stack);
    }
    
    updateUIButtons();
    
    var totalDownSpeed = 0;
    var totalUpSpeed = 0;
    for (var i = 0; i < tasks.length; i++) {
        if (tasks[i].status !== 'paused' && tasks[i].status !== 'finished') {
            totalDownSpeed += (tasks[i].speedDownload || 0);
            totalUpSpeed += (tasks[i].speedUpload || 0);
        }
    }
    
    $('#download-speed').text(bytesToString(totalDownSpeed) + '/s');
    $('#upload-speed').text(bytesToString(totalUpSpeed) + '/s');
}

function updatePopoverData() {
    console.log('[Popover] updatePopoverData() called');
    
    chrome.runtime.sendMessage({action: "ping"}, function(response) {
        if (chrome.runtime.lastError) {
            console.error('[Popover] SW unavailable (ping):', chrome.runtime.lastError.message);
            return;
        }
        console.log('[Popover] ✓ SW responding to ping');
    });
    
    setTimeout(() => {
        console.log('[Popover] Requesting device info from SW...');
        chrome.runtime.sendMessage({action: "getDeviceInfo"}, function(deviceInfo) {
            console.log('[Popover] getDeviceInfo response:', deviceInfo);
            
            if (chrome.runtime.lastError) {
                console.error('[Popover] Error getting device info:', chrome.runtime.lastError.message);
                return;
            }
            updateDeviceInfo(deviceInfo);
        });
        
        console.log('[Popover] Requesting tasks from SW...');
        chrome.runtime.sendMessage({action: "getTasks"}, function(tasks) {
            console.log('[Popover] getTasks response:', tasks);
            
            if (chrome.runtime.lastError) {
                console.error('[Popover] Error getting tasks:', chrome.runtime.lastError.message);
                return;
            }
            updateTasks(tasks);
        });
    }, 100);
}

console.log('[Popover] Helper functions defined - STEP 4');

try {
    if (extension.getLocalizedString("textDirection") == "rtl") {
        textDirection = "rtl";
        $(document.body).removeClass("ltr").addClass("rtl");
    }
    
    console.log('[Popover] Text direction set - STEP 5');
    
    // CRITICAL FIX: Wait for viewModel to be created by popover-popovermodel.js
    var initializationAttempts = 0;
    var initializePopover = function() {
        initializationAttempts++;
        
        if (typeof viewModel === 'undefined') {
            if (initializationAttempts > 100) {
                console.error('[Popover] ❌ FATAL: viewModel never created after 100 attempts (5 seconds)');
                return;
            }
            setTimeout(initializePopover, 50);
            return;
        }
        
        console.log('[Popover] ✓ viewModel found!');
        
        extension.storage.get("hideSeedingTorrents", function (storageItems) {
            if (typeof viewModel !== 'undefined') {
                viewModel.hideSeedingTorrents(storageItems["hideSeedingTorrents"] === true);
            }
        });
        
        // IMPORTANT: Set popoverVisible BEFORE initial data update!
        // This prevents the first getTasks response from being blocked
        popoverVisible = true;
        if (!popoverUpdateInterval) {
            popoverUpdateInterval = setInterval(updatePopoverData, 2000);
        }
        
        console.log('[Popover] Starting initial data update...');
        updatePopoverData();
        
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                popoverVisible = false;
                if (popoverUpdateInterval) {
                    clearInterval(popoverUpdateInterval);
                    popoverUpdateInterval = null;
                }
            } else {
                popoverVisible = true;
                updatePopoverData();
                if (!popoverUpdateInterval) {
                    popoverUpdateInterval = setInterval(updatePopoverData, 2000);
                }
            }
        });
        
        console.log('[Popover] Setting up button handlers...');
        
        // Use a timer to ensure DOM is ready
        setTimeout(function() {
            console.log('[Popover] Binding button handlers...');
            
            var addTaskBtn = document.getElementById('add-task-btn');
            var addTaskForm = document.getElementById('add-task-form');
            var urlInput = document.getElementById('url-input');
            var openWebuiBtn = document.getElementById('open-webui');
            var pauseBtn = document.getElementById('pause-all');
            var resumeBtn = document.getElementById('resume-all');
            var clearBtn = document.getElementById('clear-finished');
            var settingsBtn = document.getElementById('open-settings');
            var noConnectionDiv = document.getElementById('no-connection');
            
            console.log('[Popover] DOM Elements found:');
            console.log('  - addTaskBtn:', !!addTaskBtn);
            console.log('  - addTaskForm:', !!addTaskForm);
            console.log('  - urlInput:', !!urlInput);
            console.log('  - openWebuiBtn:', !!openWebuiBtn);
            console.log('  - settingsBtn:', !!settingsBtn);
            
            // ADD TASK BUTTON - CLICK HANDLER
            if (addTaskBtn) {
                console.log('[Popover] ✓ Found addTaskBtn, binding click handler');
                $(addTaskBtn).click(function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('[Popover] *** ADD TASK BUTTON CLICKED ***');
                    console.log('[Popover] Current form visibility');
                    
                    if (!addTaskForm) {
                        console.error('[Popover] ERROR: addTaskForm element not found!');
                        return false;
                    }
                    
                    // Toggle the .active class which controls visibility via CSS margin-top
                    if ($(addTaskForm).hasClass('active')) {
                        console.log('[Popover] Hiding form');
                        $(addTaskForm).removeClass('active');
                        addTaskForm.style.display = 'none';
                    } else {
                        console.log('[Popover] Showing form');
                        addTaskForm.style.display = 'block';  // Remove inline display:none
                        $(addTaskForm).addClass('active');
                        if (urlInput) {
                            console.log('[Popover] Focusing URL input');
                            setTimeout(function() {
                                urlInput.focus();
                            }, 100);
                        } else {
                            console.warn('[Popover] URL input not found!');
                        }
                    }
                    return false;
                });
            } else {
                console.error('[Popover] ❌ ERROR: addTaskBtn element not found!');
            }
            
            // FORM SUBMIT HANDLER
            if (addTaskForm) {
                console.log('[Popover] ✓ Found addTaskForm, binding submit handler');
                $(addTaskForm).submit(function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('[Popover] *** FORM SUBMITTED (submit event) ***');
                    submitAddTaskForm();
                    return false;
                });
                
                // Also bind to button click as backup
                var submitButton = addTaskForm.querySelector('button[type="submit"]');
                if (submitButton) {
                    console.log('[Popover] ✓ Found submit button, binding click handler');
                    $(submitButton).click(function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('[Popover] *** FORM SUBMITTED (button click) ***');
                        submitAddTaskForm();
                        return false;
                    });
                }
            } else {
                console.error('[Popover] ❌ ERROR: addTaskForm element not found!');
            }
            
            function submitAddTaskForm() {
                var url = urlInput ? urlInput.value.trim() : '';
                console.log('[Popover] URL entered:', url);
                
                if (url) {
                    console.log('[Popover] Sending addTask message to SW');
                    chrome.runtime.sendMessage({
                        action: "addTask",
                        data: {
                            url: url,
                            username: null,
                            password: null,
                            unzipPassword: null,
                            destinationFolder: null
                        }
                    }, function(response) {
                        console.log('[Popover] addTask response:', response);
                        if (response && response.success) {
                            console.log('[Popover] ✓ Task added successfully');
                            if (urlInput) urlInput.value = '';
                            $(addTaskForm).removeClass('active');
                            addTaskForm.style.display = 'none';
                            updatePopoverData();
                        } else {
                            console.error('[Popover] Task add failed:', response);
                        }
                    });
                } else {
                    console.warn('[Popover] No URL entered');
                }
            }
            
            // OPEN WEBUI BUTTON
            if (openWebuiBtn) {
                openWebuiBtn.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('[Popover] *** OPEN WEBUI CLICKED ***');
                    
                    chrome.runtime.sendMessage({action: "getSettings"}, function(settings) {
                        console.log('[Popover] Settings:', settings);
                        var dsUrl = '';
                        
                        if (settings.quickConnectId && settings.quickConnectId.length > 0) {
                            dsUrl = 'https://quickconnect.to/' + settings.quickConnectId;
                        } else {
                            var protocol = settings.protocol || 'http://';
                            //var url = settings.url || 'localhost';
                            var url = settings.url;
                            var port = settings.port || 5000;
                            dsUrl = protocol + url + ':' + port + '/index.cgi?launchApp=SYNO.SDS.DownloadStation.Application';
                        }
                        
                        console.log('[Popover] Opening URL:', dsUrl);
                        chrome.tabs.create({url: dsUrl});
                    });
                };
            }
            
            // PAUSE BUTTON
            if (pauseBtn) {
                pauseBtn.onclick = function(e) {
                    e.preventDefault();
                    console.log('[Popover] *** PAUSE CLICKED ***');
                    var ids = [];
                    for (var i = 0; i < currentTasks.length; i++) {
                        if (currentTasks[i].status === 'downloading' || currentTasks[i].status === 'waiting') {
                            ids.push(currentTasks[i].id);
                        }
                    }
                    if (ids.length > 0) {
                        chrome.runtime.sendMessage({action: "pauseTask", data: ids}, function(response) {
                            updatePopoverData();
                        });
                    }
                };
            }
            
            // RESUME BUTTON
            if (resumeBtn) {
                resumeBtn.onclick = function(e) {
                    e.preventDefault();
                    console.log('[Popover] *** RESUME CLICKED ***');
                    var ids = [];
                    for (var i = 0; i < currentTasks.length; i++) {
                        if (currentTasks[i].status === 'paused') {
                            ids.push(currentTasks[i].id);
                        }
                    }
                    if (ids.length > 0) {
                        chrome.runtime.sendMessage({action: "resumeTask", data: ids}, function(response) {
                            updatePopoverData();
                        });
                    }
                };
            }
            
            // CLEAR BUTTON
            if (clearBtn) {
                clearBtn.onclick = function(e) {
                    e.preventDefault();
                    console.log('[Popover] *** CLEAR FINISHED CLICKED ***');
                    chrome.runtime.sendMessage({action: "clearFinishedTasks"}, function(response) {
                        updatePopoverData();
                    });
                };
            }
            
            // SETTINGS BUTTON
            if (settingsBtn) {
                settingsBtn.onclick = function(e) {
                    e.preventDefault();
                    console.log('[Popover] *** SETTINGS CLICKED ***');
                    chrome.runtime.openOptionsPage();
                };
            }
            
            // NO CONNECTION MESSAGE CLICK
            if (noConnectionDiv) {
                noConnectionDiv.onclick = function(e) {
                    e.preventDefault();
                    console.log('[Popover] *** NO CONNECTION CLICKED - OPENING SETTINGS ***');
                    chrome.runtime.openOptionsPage();
                };
            }
            
            console.log('[Popover] ✓ ALL BUTTON HANDLERS BOUND');
            
        }, 50);
        
        console.log('[Popover] ✓ Initialization complete!');
    };
    
    console.log('[Popover] Starting initialization checks...');
    initializePopover();
    
} catch (exc) {
    console.error('[Popover] EXCEPTION:', exc.message);
    console.error('[Popover] Stack:', exc.stack);
}

console.log('[Popover] popover.js END');

(function() {
	"use strict";
	
	if (!document.body) {
		return;
	}

	var dseCurrentIcon = null;
    var bodyOverflowStyle = document.body.style.overflow;
	
	// MV3: Replace deprecated chrome.extension.onMessage with chrome.runtime.onMessage
	chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
		console.log('Content script received message:', request);
		
		// Check if message is from background and we're in top frame
		if(request.name == "hud" && top === self) {
			showHud(request.message);
		}
		else if (request.name == "openDownloadDialog" && top === self) {
			showNewTaskDialog(request.message.url);
		}
        else if (request.name == "removeDialog") {
            var el = document.getElementById(request.message.dialogId);
            if (el) el.remove();
            document.body.style.overflow = bodyOverflowStyle;
        }
		
		return true; // Keep message channel open
	});
	
	// MV3: Replace extension.sendMessageToBackground with chrome.runtime.sendMessage
	chrome.runtime.sendMessage({
		action: "getProtocols"
	}, function(protocols) {
		bindProtocolEvents(protocols);
	});
	
    document.body.addEventListener('click', function(event) {
        if (event.target.closest('#dse-hud')) {
            event.currentTarget.classList.remove('visible');
        }
    });	
	
    function showHud(hudItem) {
        if (hudItem.icon == undefined || hudItem.icon == null)
            hudItem.icon = 'progress';
        
        var container = document.getElementById('dse-hud');
        if (!container) {
            var resetContainer = document.createElement('div');
            resetContainer.className = 'yui3-cssreset';
            container = document.createElement('div');
            container.id = 'dse-hud';
            container.innerHTML = '<div id="dse-icon"></div><div id="dse-message"></div>';
            resetContainer.appendChild(container);
            document.body.appendChild(resetContainer);
        }
        
        var message = document.getElementById('dse-message');
        var icon = document.getElementById('dse-icon');
        
        var iconUrl = chrome.runtime.getURL('css/img/hud-' + hudItem.icon + '.png');
        if (container.classList.contains('visible') && hudItem.icon != dseCurrentIcon) {
            icon.style.opacity = '0';
            setTimeout(function() {
                icon.style.backgroundImage = 'url(' + iconUrl + ')';
                icon.style.opacity = '1';
            }, 200);
        } else {
            icon.style.backgroundImage = 'url(' + iconUrl + ')';
        }
        dseCurrentIcon = hudItem.icon;
        
        if (hudItem.action === 'show') {
            if (message.textContent != hudItem.text && message.textContent != '' && container.classList.contains('visible')) {
                message.style.opacity = '0';
                setTimeout(function() {
                    message.textContent = hudItem.text;
                    message.style.opacity = '1';
                }, 200);
            } else {
                message.textContent = hudItem.text;
                setTimeout(function() { message.classList.add('visible'); }, 1);
            }
            
            if (hudItem.autoHide)
                setTimeout(function() { container.classList.remove('visible'); }, 3000);
            
            setTimeout(function() { container.classList.add('visible'); }, 1);
        }
        else if (hudItem.action === 'hide') {
            setTimeout(function() { container.classList.remove('visible'); }, 1);
        }
    }
	
    function bindProtocolEvents(protocols) {
        if (!protocols || protocols.length === 0) return;
        
        document.body.addEventListener('click', function(event) {
        var anchor = event.target.closest('a[href]');
        if (!anchor) return;
            
            var href = anchor.getAttribute('href') || '';
            var matched = protocols.some(function(p) { return href.startsWith(p); });
            if (!matched) return;
            
            event.preventDefault();
            event.stopImmediatePropagation();
            
            chrome.runtime.sendMessage({
                action: 'addTaskWithHud',
                data: {
                    url: href,
                    taskType: href.split(':')[0]
                }
            });
        }, true); // capture phase
    }	
    
	function showNewTaskDialog(url) {
		var dialogId = Math.random().toString(36).substring(7);
		var dialogFrame = document.createElement("iframe");
		dialogFrame.src = extension.getResourceURL('download-dialog.html?id=' + encodeURIComponent(dialogId) + '&url=' + encodeURIComponent(url));
		dialogFrame.id = dialogId;
		dialogFrame.setAttribute('allowtransparency', 'true');
		dialogFrame.setAttribute('frameborder', '0');
		dialogFrame.setAttribute("style", "position: fixed!important; width: 100%!important; height: 100%!important; top: 0!important; left: 0!important; z-index: 2147483647!important;");
		document.body.appendChild(dialogFrame);
		document.body.style.overflow = "hidden";
	}
})();
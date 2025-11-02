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
			$("iframe#" + request.message.dialogId).remove();
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
	
	$("body").on("click", "#dse-hud", function() {
		$(this).removeClass('visible');
	});
	
	function showHud(hudItem)
	{
		var container = $("#dse-hud");
		if(container.length === 0) {
			var resetContainer = $('<div class="yui3-cssreset"></div>').appendTo('body');
			container = $('<div id="dse-hud"></div>').appendTo(resetContainer);
			container.html('<div id="dse-icon"></div><div id="dse-message"></div>');
		}
		
		var message = $('#dse-message');
		var icon = $('#dse-icon');
		
		// Update icon
		if(hudItem.icon == undefined || hudItem.icon == null)
			hudItem.icon = 'progress';
		
		if(container.hasClass('visible') && hudItem.icon != dseCurrentIcon) {
			icon.fadeOut(200, function() {
				icon.css('background-image', 'url('+extension.getResourceURL('css/img/hud-'+hudItem.icon+'.png')+')').fadeIn(200);
			});
		}
		else
			icon.css('background-image', 'url('+extension.getResourceURL('css/img/hud-'+hudItem.icon+'.png')+')');
		dseCurrentIcon = hudItem.icon;
		
		// Update hud
		if(hudItem.action === 'show')
		{
			if(message.text() != hudItem.text && message.text() != '' && container.hasClass('visible')) {
				message.fadeOut(200, function() {
		            message.text(hudItem.text).fadeIn(200);
				});
			}
			
			else {
				message.text(hudItem.text);
				setTimeout(function() {message.addClass('visible')}, 1);
			}
			
			if(hudItem.autoHide)
				setTimeout(function() {container.removeClass('visible')}, 3000);
	        
			setTimeout(function() {container.addClass('visible')}, 1);
		}
		else if(hudItem.action === 'hide')
		{
			setTimeout(function() {container.removeClass('visible')}, 1);
		}
	}
	
	function bindProtocolEvents(protocols) {
		for(var i = 0; i < protocols.length; i++) {
			$("body").on("click", "a[href^='" + protocols[i] + "']", function(event) {
				event.preventDefault();
				// MV3: Replace extension.sendMessageToBackground with chrome.runtime.sendMessage
				chrome.runtime.sendMessage({
					action: "addTaskWithHud",
					data: {
						url: $(this).prop("href"),
						taskType: protocols[i]
					}
				});
			});
		}
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

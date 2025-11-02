/// <reference path="../../typings/jquery/jquery.d.ts"/>
/// <reference path="../../typings/showdown/showdown.d.ts"/>
// MV3: All background communication uses chrome.runtime.sendMessage, no window dependencies
$(document).ready(function() {
	if(location.hash.length > 0)
		$("#menu a[href='" + location.hash + "']").tab("show");
	
	// !Localize page
	$('[data-message]').each(function() {
		var name = $(this).data('message');
		$(this).text(extension.getLocalizedString(name));
	});
	
	$('[data-attr-message]').each(function() {
		var attributes = $(this).data('attr-message').split(',');
		for(var i = 0; i < attributes.length; i++) {
			var parts = attributes[i].split('|');
			var attr = parts[0];
			var name = parts[1];
			$(this).attr(attr, extension.getLocalizedString(name));
		}
	});
	
	$("#about-extension-version").text(extension.getExtensionVersion());
	
	// Fetch and display latest version
	getLatestVersion();
	
	$('#donate-button').attr('href', DONATION_URL);
	$('#donate-button2').attr('href', DONATION_URL2);
	
	loadChangelog();
	
	// Creating custom :external selector
	$.expr[':'].external = function(obj){
		return !obj.href.match(/^mailto\:/) && (obj.hostname != location.hostname);
	};

	// External links
	// MV3: Use chrome.tabs.create instead of window.open
	$('a:external').click(function(evt) {
		evt.preventDefault();
		var url = $(this).attr('href');
		
		if (IS_CHROME) {
			chrome.tabs.create({ url: url });
		} else if (IS_SAFARI) {
			window.open(url, '_blank');
		}
	});
	
	$("a").each(function(index, element) {
		var url = $(this).prop('href');
		
		if(url.indexOf("download-station-extension.com") != -1) {
			var medium = "unknown";
			if(IS_CHROME)
				medium = "Chrome";
			else if(IS_SAFARI)
				medium = "Safari";
			
			url = url + "?utm_source=extension&utm_medium=" + medium + "&utm_campaign=settings";
			
			$(this).prop("href", url);
		}
	});
	
	$("[title], #options-form select[title], #options-form label[title]").popover({
		placement: "right",
		trigger: "hover",
		container: "body"
	});
	
	
	
	$("#enableQuickConnect").on("click", function() {
		toggleQuickConnect(true);
	});
	
	$("#disableQuickConnect").on("click", function() {
		toggleQuickConnect(false);
	});
	
	$("#updateInBackground").on("change", function() {
    	var disabled = !$(this).is(":checked");
    	$("#backgroundUpdateInterval").prop("disabled", disabled);
	});
	
	$('input[name=protocol]').change(function(){
		var value = $('input[name=protocol]:checked').val();
		var port = $('#port').val();
		if(port == '' || port == '5000' || port == '5001') {
			if(value == 'http://')
				$('#port').val('5000');
			else
				$('#port').val('5001');
		}
	});
	
	$('#test-connection').click(function(event) {
		event.preventDefault();
		
		if(IS_SAFARI && $("#connection")[0].checkValidity() == false)
		{
			showDialog("Warning", "Not all fields have been entered correctly. Please make sure that you have entered all information correctly.");
			return;
		}
		
		var $this = $(this);
		$(".fa-flask", $this).hide();
		$(".fa-spinner", $this).show();
		$("form#connection button").prop("disabled", true);
		
		var newOptions = getConnectionFormData();
		
		// MV3: Use chrome.runtime.sendMessage instead of extension.sendMessageToBackground
		chrome.runtime.sendMessage({
			action: "testConnection",
			data: newOptions
		}, function(response) {
			var form = $("form#connection");
				$("#test-connection .fa-spinner", form).hide();
				$("#test-connection .fa-flask", form).show();
				
				$("button", form).prop("disabled", false);
				
				if(!response) {
					showDialog(extension.getLocalizedString("testDialogFailed"), "No response from background", "fa-exclamation-triangle");
				}
				else if(response.success === true)
					showDialog(extension.getLocalizedString("testDialogSuccess"), response.message, "fa-check-circle");
				else
					showDialog(extension.getLocalizedString("testDialogFailed"), response.message, "fa-exclamation-triangle");
		});
	});
	
	$(document.body).on("submit", "#connection", function(evt) {
		evt.preventDefault();
		
		if(IS_SAFARI && $(this)[0].checkValidity() == false)
		{
			showDialog("Warning", "Not all fields have been entered correctly. Please make sure that you have entered all information correctly.");
			return;
		}
		
		var newOptions = getConnectionFormData();
		
		$("button", this).attr("disabled", true);
		$("button[type=submit] .fa-spinner", this).show();
		$("button[type=submit] .fa-save", this).hide();
		
		// MV3: Use chrome.runtime.sendMessage
		chrome.runtime.sendMessage({
			action: "saveConnectionSettings",
			data: newOptions
		}, function(response) {
			var form = $("form#connection");
			$("button .fa-save", form).show();
			$("button .fa-spinner", form).hide();
			$("button", form).prop("disabled", false);
			
			if(response.success == true)
				showDialog(extension.getLocalizedString("settingsSaved"),
							extension.getLocalizedString("settingsSavedMessage"), "fa-check-circle");
			else
				showDialog(extension.getLocalizedString("testDialogFailed"), response.message, "fa-exclamation-triangle");
		});
	});
	
	$(document.body).on("submit", "#other-settings", function(evt) {
		evt.preventDefault();
		
		if(IS_SAFARI && $(this)[0].checkValidity() == false)
		{
			showDialog("Warning", "Not all fields have been entered correctly. Please make sure that you have entered all information correctly.");
			return;
		}
		
		var newOptions = getOtherSettingsFormData();
		
		$("button", this).attr("disabled", true);
		$("button[type=submit] .fa-spinner", this).show();
		$("button[type=submit] .fa-save", this).hide();
		
		// MV3: Use chrome.runtime.sendMessage
		chrome.runtime.sendMessage({
			action: "saveOtherSettings",
			data: newOptions
		}, function(response) {
			var form = $("form#other-settings");
			$("button .fa-save", form).show();
			$("button .fa-spinner", form).hide();
			$("button", form).prop("disabled", false);
			
			if(response.success == true)
				showDialog(extension.getLocalizedString("settingsSaved"),
							extension.getLocalizedString("settingsSavedMessage"), "fa-check-circle");
			else
				showDialog(extension.getLocalizedString("testDialogFailed"), response.message, "fa-exclamation-triangle");
		});
	});
	
	if(IS_CHROME) {
		extension.storage.addEventListener(function(changes) {
			for(var key in changes)
			{
				var elements = $("[name='" + key + "']");
				var inputType = elements.prop("type");
				var newValue = changes[key].newValue;
				if(["text", "email", "password", "number"].indexOf(inputType) != -1) {
					elements.val(newValue);
				}
				else if(inputType == "checkbox" && typeof(newValue) === "boolean")
					elements.prop("checked", newValue);
				else if(inputType == "checkbox" && Array.isArray(newValue))
				{
					elements.prop("checked", false);
					elements.each(function(index, element) {
						$(element).prop("checked", newValue.contains($(element).val()));
					});
				}
				else if(inputType == "radio") {
					elements.each(function(index, element) {
						$(element).prop("checked", newValue == $(element).val());
					});
				}
			}
			$("#updateInBackground").trigger("change");
		});
	}
	
	// !Load settings
	// MV3: Use chrome.runtime.sendMessage
	chrome.runtime.sendMessage({
		action: "getSettings"
	}, function(response) {
		setOptionFields(response);
	});
});

function toggleQuickConnect(enabled)
{
	$("#enableQuickConnect").toggleClass("btn-primary active disabled", enabled);
	$("#disableQuickConnect").toggleClass("btn-primary active disabled", !enabled);
	
	$("#manual-settings").toggle(enabled == false);
	$("#manual-settings input").prop("disabled", enabled);
		
	$("#quickconnect-settings").toggle(enabled);
	$("#quickconnect-settings input").prop("disabled", enabled == false);
	
	$("#quickConnectId").prop("required", enabled);
	$("#url").prop("required", enabled == false);
	$("#port").prop("required", enabled == false);
	$("input[name=protocol]").prop("required", enabled == false);
}

function getConnectionFormData() {
	var data = $("form#connection").serializeArray();
	var newOptions = {};
	
	$.each(data, function(index, field) {
		newOptions[field.name] = field.value;
	});
	
	newOptions.updateInBackground = newOptions.updateInBackground == "on";
	//newOptions.updateInBackground = newOptions.updateInBackground == "off";
	newOptions.backgroundUpdateInterval = parseInt(newOptions.backgroundUpdateInterval);
	if(isNaN(newOptions.backgroundUpdateInterval) || newOptions.backgroundUpdateInterval < 5)
		newOptions.backgroundUpdateInterval = 20;
	
	return newOptions;
}

function getOtherSettingsFormData() {
	var data = $("form#other-settings").serializeArray();
	var newOptions = {};
	
	$.each(data, function(index, field) {
		newOptions[field.name] = field.value;
	});
	
	newOptions.hideSeedingTorrents = newOptions.hideSeedingTorrents == "on";
    // Notify popover of setting change
    chrome.runtime.sendMessage({
        action: "settingChanged",
        setting: "hideSeedingTorrents",
        value: newOptions.hideSeedingTorrents
    });
	newOptions.openProtocols = [];
	
	$("input[type=checkbox][name=openProtocols]:checked").each(function(index, element) {
		newOptions.openProtocols.push($(element).val());
	});
	
	return newOptions;
}

function getLatestVersion() {
    chrome.runtime.sendMessage({
        action: "getLatestVersion"
    }, function(response) {
        if (response) {
            var latestVersion = response.replace(/^v/, '');  // Remove 'v' prefix
            var currentVersion = extension.getExtensionVersion();
            if (compareVersion(latestVersion, currentVersion) > 0) {
                $("#about-latest-version").text(latestVersion);
                // Show the version display after setting the text
                document.getElementById('about-latest-version').parentElement.style.display = 'block';
            }
        }
    });
}

function compareVersion(latestTag, currentVersion) {
	var v1parts = latestTag.toString().split('.');
	var v2parts = currentVersion.toString().split('.');
	
	while(v1parts.length < v2parts.length) {
		v1parts.push(0);
	}
	
	while(v2parts.length < v1parts.length) {
		v2parts.push(0);
	}
	
	for (var i = 0; i < v1parts.length; ++i) {
		var v1part = parseInt(v1parts[i]);
		var v2part = parseInt(v2parts[i]);
		
		if(isNaN(v1part))
			v1part = 0;
		if(isNaN(v2part))
			v2part = 0;
		
		if (v1part == v2part) {
			continue;
		}
		else if (v1part > v2part) {
			return 1;
		}
		else {
			return -1;
		}
	}
	
	return 0;
}

function setOptionFields(options) {
    if (!options) options = {};
    if (!options.openProtocols) options.openProtocols = [];
    if (!options.protocol) options.protocol = 'http://';
    //if (!options.url) options.url = 'localhost';
    if (!options.url) options.url = '';
    //if (!options.port) options.port = 5000;
    if (!options.port) options.port = '';
    if (!options.backgroundUpdateInterval) options.backgroundUpdateInterval = 20;
	
	var quickConnectEnabled = options.quickConnectId != null && options.quickConnectId.length > 0;
	
	toggleQuickConnect(quickConnectEnabled);
	if(quickConnectEnabled)
	{
		$('#quickConnectId').val(options.quickConnectId);
	}
	else
	{
		$("input[name=protocol][type=radio][value='" + options.protocol + "']").prop("checked", true);
		$('#url').val(options['url']);
		$('#port').val(options['port'] || 5000);
		//$('#port').val(options['port']);
	}
	
	$('#username').val(options.username);
	$('#password').val(options.password);
	
	$('#email').val(options.email);
	$('#backgroundUpdateInterval').val(options.backgroundUpdateInterval);
	
	$('#hideSeedingTorrents').prop('checked', options.hideSeedingTorrents);
	$('#updateInBackground').prop('checked', options.updateInBackground);
	
	for(var i = 0; i < options.openProtocols.length; i++)
	{
		$("input[name='openProtocols'][value='" + options.openProtocols[i] + "']").prop("checked", true);
	}
	
	$("#updateInBackground").trigger("change");
	$("#email").trigger("input");
}

function showDialog(title, text, icon) {
	var html = '<div class="modal fade out">\
					<div class="modal-dialog">\
						<div class="modal-content">\
							<div class="modal-header">\
								<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>\
								<h3 class="modal-title">' + title + '</h3>\
							</div>\
							<div class="modal-body">\
								<p>'+ (typeof icon === "string" ? '<i class="fa ' + icon + '"></i> ' : '') + text + '</p>\
							</div>\
							<div class="modal-footer">\
								<a href="#" class="btn btn-primary" data-dismiss="modal">Ok</a>\
							</div>\
						</div>\
					</div>\
				</div>';
	$(html).modal().on("hidden", function() {
		$(this).remove();
	});
}

function loadChangelog() {
	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function() {
		if( xhr.readyState === XMLHttpRequest.DONE ) {
			if ( (xhr.status >= 200 && xhr.status < 300 ) || xhr.status === 0 ) {
				var converter = new showdown.Converter();
				var html = converter.makeHtml(xhr.responseText);
				$("#changelog-content").html(html);
			}
		}
	};
	xhr.open("GET", extension.getResourceURL("changelog.md"), true);
	xhr.send();
}

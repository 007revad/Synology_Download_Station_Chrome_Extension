ko.bindingHandlers.bsTooltip = {
	init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
		
		var options = ko.utils.unwrapObservable(valueAccessor());
		var visible = ko.utils.unwrapObservable(options.visible);
		var title = ko.utils.unwrapObservable(options.title);
		var viewport = ko.utils.unwrapObservable(options.viewport);
		
		$(element).tooltip({
			viewport: viewport ? viewport : 'body',
			placement: "bottom",
			title: options.hasOwnProperty("title") ? title : $(element).prop("title"),
			trigger: options.hasOwnProperty("visible") ? "manual" : "hover focus",
			template: '<div class="tooltip tooltip-danger"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>'
		});
		
		
		var updateVisible = function (newValue) {
			var tip = $(element).data("bs.tooltip").$tip;
			var oldState = tip && tip.is(":visible");
			if(newValue && !oldState)
				$(element).tooltip("show");
			else if(!newValue && oldState)
				$(element).tooltip("hide");
		}
		
		var updateTitle = function (newValue) {
			
			if(!newValue) {
				updateVisible(false);
			}
			else {
				$(element).attr('title', newValue)
						  .attr('data-original-title', newValue)
						  .tooltip('fixTitle')
						  .data("bs.tooltip");
						  
				var tip = $(element).data("bs.tooltip").$tip;
				if(tip)
					tip.find(".tooltip-inner").text(newValue);
			}
		}
		
		var titleSubscription;
		if(ko.isObservable(options.title))
		{
			titleSubscription = options.visible.subscribe(updateTitle);
		}
		
		var visibleSubscription;
		if(ko.isObservable(options.visible))
		{
			visibleSubscription = options.visible.subscribe(updateVisible);
		}
		
		ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
			
			if(visibleSubscription)
				visibleSubscription.dispose();
			
			if(titleSubscription)
				titleSubscription.dispose();
			
			$(element).tooltip("destroy");
		});
		
		updateVisible(visible);
	}
};



var viewModel;
$(document).ready(function(){
	
	// !Localize the page
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
	
	$(document).on("click", "[data-toggle-show-password]", function(event) {
		event.preventDefault();
		var inputId = $(this).data("toggle-show-password");
		
		var passwordInput = $("#" + inputId);
		
		if(passwordInput.prop("type") == "password")
		{
			$(this).find(".fa").removeClass("fa-eye").addClass("fa-eye-slash");
			passwordInput.prop("type", "text");
		}
		else
		{
			$(this).find(".fa").removeClass("fa-eye-slash").addClass("fa-eye");
			passwordInput.prop("type", "password");
		}
		
		passwordInput.focus();
	});
/*
	
	$("#url").val(urls.join("\n"));
*/
	
	$(document.body).popover({
		placement: "auto left",
		trigger: "focus",
		container: "body",
		selector: "input[data-content], textarea[data-content], select[data-content]"
	}).on("shown", function(event) {
		event.stopPropagation();
	}).on("hidden", function(event) {
		event.stopPropagation();
	});
	
	var getParams = $.deparam(window.location.search.replace("?", ""));
	
	viewModel = new DownloadDialogViewModel();
	viewModel.checkSupportedFeatures();
	
	var initialFolder = createFoldersForPath("/");
	viewModel.setCurrentFolder(initialFolder);
	viewModel.urls(getParams.url);
	
	ko.applyBindings(viewModel);
	
	$("#add-download").bind("shown.bs.modal", "#add-download", function(event) {
		if($(event.target).get(0) === $("#add-download").get(0)){
			viewModel.setUrlsTextareaHeight();
		}
	});
	
	$('#add-download').bind('hidden.bs.modal', "#add-download", function (event) {
		if($(event.target).get(0) === $("#add-download").get(0)){
			extension.sendMessageToBackground("sendRemoveDialogMessage", { dialogId: getParams.id });
		}
	});
	
	$('#add-download').modal("show");
});

function createFoldersForPath(path)
{
	var levels = path.split("/");
	
	var parentFolder = new Folder({
		name: "/",
		path: "/",
		right: "RO"
	}, null);
	
	var folderPath = "";
	for(var i = 0; i < levels.length; i++)
	{
		if(levels[i])
		{
			folderPath += "/" + levels[i];
			parentFolder = new Folder({
				name: levels[i],
				path: folderPath
			}, parentFolder);
		}
	}
	
	return parentFolder;
}


function DownloadDialogViewModel()
{
	"use strict";
	var self = this;
	
	this.urls = ko.observable();
	this.username = ko.observable();
	this.password = ko.observable();
	this.unzipPassword = ko.observable();
	
	this.setUrlsTextareaHeight = function() {
		var urlsTextarea = $("#urls");
		urlsTextarea.css("height", "0px");
		var height = urlsTextarea.prop("scrollHeight") + 2;
		if(height < 34)
			height = 34;
		else if(height > 150)
			height = 150;
		urlsTextarea.css("height", height + "px");
	};
	
	this.extractUrls = function()
	{
		var urls = this.urls().extractUrls().join("\n");
		this.urls(urls);
		this.setUrlsTextareaHeight();
	}
	
	this.submitDownloadError = ko.observable();
	this.submittingDownload = ko.observable(false);
	this.submitDownload = function(formElement)
	{
		if(!self.formValid())
			return;
		
		var messageData = {
			url: this.urls(),
			username: this.username(),
			password: this.password(),
			unzipPassword: this.unzipPassword(),
			taskType: 'Dialog'
		};
		
		if(self.customDestinationFolderSupported() && self.useCustomDestinationFolder())
		{
			messageData.destinationFolder = self.currentFolder().path();
		}
		
		
		self.submittingDownload(true);
		self.submitDownloadError(null);
		
		extension.sendMessageToBackground("addTask", messageData, function(response)
		{
			self.submittingDownload(false);
			
			if(!response.success)
			{
				var errorMessage = response.data ? response.data : "downloadTaskNotAccepted";
				self.submitDownloadError(extension.getLocalizedString("api_error_" + errorMessage));
			}
			else
			{
				$("#add-download").modal("hide");
			}
		});
	}
	
	this.formValid = ko.computed(function(){
		if(!self.urls() || self.urls().extractUrls().length == 0)
			return false;
		
		if(self.useCustomDestinationFolder() && (!self.currentFolder() || self.currentFolder().readOnly()))
			return false;
		
		return true;
	});
	
	this.checkSupportedFeatures = function() {
    	extension.sendMessageToBackground("getSupportedFeatures", null, function(features){
        	self.customDestinationFolderSupported(features.destinationFolder);
    	});
	}
	
	this.customDestinationFolderSupported = ko.observable(null);
	this.useCustomDestinationFolder = ko.observable(false);
	
	// Folder selection
	this.currentFolder = ko.observable();
	this.newFolderName = ko.observable();
	this.newFolderErrorMessage = ko.observable();
	this.newFolderSubmitting = ko.observable(false);
	
	this.newFolderNameValid = ko.computed(function() {
		var value = $.trim(self.newFolderName());
		var regExp = new RegExp("^[^\\\/\?\*\"\>\<\:\|]*$"); // directory name regex (http://www.regxlib.com/REDetails.aspx?regexp_id=1652)
		return value.length > 0 && regExp.test(value);
	});
	
	this.folderPath = ko.computed(function(){
		var foldersInPath = [];
		
		if(self.currentFolder())
		{
			foldersInPath.push(self.currentFolder());
			
			var folder = self.currentFolder();
			while(folder.parentFolder)
			{
				folder = folder.parentFolder;
				foldersInPath.push(folder);
			}
		}
		return foldersInPath.reverse();
	});
	
	this.enableCustomDestinationFolder = function() {
		if(!self.useCustomDestinationFolder())
			self.useCustomDestinationFolder(true);
	}
	
	this.setCurrentFolder = function(folder) {
		if(folder.name.editing())
			return;
		
		if(!folder.foldersLoaded())
		{
			folder.refresh();
		}
		
		self.currentFolder(folder);
	};
	
	this.createNewFolder = function(formElement) {
		if(!self.newFolderNameValid() || self.newFolderSubmitting()) return;
		
		this.newFolderErrorMessage(null);
		this.newFolderSubmitting(true);
		
		var message = {
			path: this.currentFolder().path(),
			name: this.newFolderName()
		};
		extension.sendMessageToBackground("createFolder", message, function(response) {
			self.newFolderSubmitting(false);
			
			if(!response.success)
			{
				var errorMessage;
				if(Array.isArray(response.errors) && response.errors.length > 0)
				{
					errorMessage = response.errors[0].message;
				}
				else
				{
					errorMessage = response.data;
				}
				self.newFolderErrorMessage(extension.getLocalizedString("api_error_" + errorMessage));
			}
			else
			{
				self.newFolderName(null);
				self.currentFolder().refresh();
			}
			
			$(formElement).find("input").focus();
		});
	};
}

function Folder(details, parent) {
	var self = this;
	this.parentFolder = parent;
	this.name = ko.observable(details.text ? details.text : details.name);
	this.path = ko.observable(details.spath ? details.spath : details.path);
	this.readOnly = ko.observable(details.right ? details.right == "RO" : false);
	this.folders = ko.observableArray();
	
	this.foldersLoaded = ko.observable(false);
	this.loadingFolders = ko.observable(false);
	this.errorMessage = ko.observable();
	
	this.name.editing = ko.observable(false);
	this.name.unsaved = ko.observable();
	this.name.error = ko.observable(null);
	this.name.saving = ko.observable(false);
	
	this.name.focus = ko.computed(function() {
		return self.name.editing();
	});
	
	this.refresh = function() {
		ko.utils.arrayForEach(this.folders(), function(folder) {
			folder.parentFolder = null;
        });
        
        this.folders.removeAll();
		this.errorMessage(null);
        this.loadingFolders(true);
        
		extension.sendMessageToBackground("listFolders", this.path(), function(response) {
			
			if(!response.success)
			{
				var localizedMessage = extension.getLocalizedString("api_error_" + response.data);
				self.errorMessage(localizedMessage);
			}
			else
			{
				for(var i = 0; i < response.data.length; i++)
				{
					var folder = new Folder(response.data[i], self);
				}
				self.foldersLoaded(true);
			}
			
			self.loadingFolders(false);
		});
	};
	
	this.rename = function(folder, event)
	{
		self.name.unsaved(self.name());
		self.name.editing(true);
	}
	
	this.renameSave = function(){
		self.name.saving(true);
		self.name.error(null);
		
		var message = {
			path: this.path(),
			name: this.name.unsaved()
		};
		
		extension.sendMessageToBackground("rename", message, function(response) {
    		self.name.saving(false);
			
			if(!response.success)
			{
				var errorMessage;
				if(Array.isArray(response.errors) && response.errors.length > 0)
				{
					errorMessage = response.errors[0].message;
				}
				else
				{
					errorMessage = response.data;
				}
				self.name.error(extension.getLocalizedString("api_error_" + errorMessage));
			}
			else
			{
				self.name.unsaved(null);
				self.name(response.data.name);
				self.path(response.data.path);
				self.name.editing(false);
			}
			
			self.name.saving(false);
		});
	}
	
	this.renameKeyUp = function(data, event) {
		if(event.which === 13) // ENTER
			self.renameSave();
		else if( event.which === 27) { // ESC
			self.renameCancel();
		}
	}
	
	this.renameCancel = function() {
		self.name.error(null);
		self.name.unsaved(null);
		self.name.editing(false);
	}
	
	this.remove = function() {
		self.remove.confirm(true);
	}
	
	this.remove.confirm = ko.observable(false);
	this.remove.error = ko.observable(null);
	this.remove.removing = ko.observable(false);
	
	this.removeCancel = function() {
		self.remove.error(null);
		self.remove.confirm(false);
	}
	
	this.removeConfirm = function() {
		self.remove.removing(true);
		self.remove.error(null);
		
		var message = {
			path: this.path()
		};
		
		extension.sendMessageToBackground("delete", message, function(response) {
			
			self.remove.removing(false);
			
			if(!response.success)
			{
				var errorMessage;
				if(Array.isArray(response.errors) && response.errors.length > 0)
				{
					errorMessage = response.errors[0].message;
				}
				else
				{
					errorMessage = response.data;
				}
				self.remove.error(extension.getLocalizedString("api_error_" + errorMessage));
			}
			else
			{
				self.parentFolder.folders.remove(self);
			}
		});
	}
	
	
	if(parent)
	{
		parent.folders.push(this);
	}
}
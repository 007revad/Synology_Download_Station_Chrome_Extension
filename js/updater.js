function ExtensionUpdater ()
{
	"use strict";
	var self = this;
	
	this.run = function() {
		var currentVersion = extension.getExtensionVersion();
		extension.storage.get("extensionVersion", function(storageItems) {
			var previousVersion = storageItems.extensionVersion || "1.6.3";
			self.update(previousVersion, currentVersion);
			extension.storage.set({ extensionVersion: currentVersion});
		});
	};
	
	this.update = function (fromVersion, toVersion) {
		
		if(this.compareVersion(fromVersion, toVersion) == -1)
		{
			for (var i = 0; i < this.changes.length; i++)
			{
				var change = this.changes[i];
				if(this.compareVersion(fromVersion, change.version) <= 0 && this.compareVersion(toVersion, change.version) >= 0)
				{
					change.updateFunction();
					console.log("Update function %s executed.", change.version);
					extension.storage.set({ extensionVersion: change.version });
				}
			}
			console.log("Extension updated from %s to %s.", fromVersion, toVersion);
			_gaq.push(['_trackEvent', 'Startup', 'Updated', 'From ' + fromVersion + ' to ' + toVersion]);
		}
	};
	
	this.compareVersion = function (version, compareToVersion) {
		var v1parts = version.toString().split('.');
		var v2parts = compareToVersion.toString().split('.');
		
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
	};
	
	this.changes = [
		/*{
			version: "2.0.3",
			updateFunction : function() {}
		}*/
	];
}
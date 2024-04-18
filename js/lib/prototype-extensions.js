(function() {
	"use-strict";
	
	String.prototype.removeUrlParameters = function() {
		var newUrl = this;
		var index = this.indexOf('?');
		
		if(index == -1){
		    index = this.indexOf('#');
		}
		if(index != -1){
		    newUrl = this.substring(0, index);
		}
		return newUrl;
	};
})();
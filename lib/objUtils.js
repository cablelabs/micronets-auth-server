var self = module.exports = {

	extract: function(srcObj) {
		var obj = {};
	    for (var i in arguments) {
	    	var key = arguments[i];
	        if (this.hasOwnProperty(key)) {
	            obj[key] = this[key];
	        }
	    }
    	return obj;
	}
}
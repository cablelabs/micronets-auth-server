var self = module.exports = {

	extract: function(srcObj) {
		var obj = {};
	    for (var i in arguments) {
	    	var key = arguments[i];
	    	console.log("checking: "+key);
	        if (this.hasOwnProperty(key)) {
	            obj[key] = this[key];
	        }
	    }
    	return obj;
	}
}
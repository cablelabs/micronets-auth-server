var self = module.exports = {

	extract: function(srcObj, srcKeys) {
		var obj = {};
	    for (var i in srcKeys) {
	    	var key = srcKeys[i];
	        if (srcObj.hasOwnProperty(key)) {
	            obj[key] = srcObj[key];
	        }
	    }
    	return obj;
	}
}
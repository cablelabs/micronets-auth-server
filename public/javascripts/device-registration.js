// Must match route in routes/index.js
let baseURL = location.href.substring(0,location.href.indexOf('/register-device'));

function onLoad() {
	setTimeout(function(){
		$('#preloaderSpinner').addClass("invisible");

		$('#preloaderSpinner').one('transitionend', function(e){
			$('#preloaderSpinner').css("display", "none");
		});

	},2000);

	// If user switches window, abort the sequence.
	$(window).blur(function(){

		return;

		// Notify parent
		postRobot.send(window.opener, 'error', { code: 0, error: ''});
		setTimeout(function(){
			window.close();
		}, 200);
	});

	$(window).unload(function(){
		// Notify parent
		postRobot.send(window.opener, 'error', { code: 0, error: ''});
		setTimeout(function(){
			return;
		}, 200);
	});

	// TESTING ONLY!
	$('#qrcode img').on("click", function() {
		// Simulate IdOra authsession (QRCode Scan) using special grandma's access token.
		var sessionId = $('#sessionId').html();
	    var request = new XMLHttpRequest();
	    var options = {
	    	method: 'POST',
	    	headers:{"authorization" : "bearer grandma-super-secret-access-token"}};

	    request.body = "sessionId="+sessionId+"&username=grandma";

	    request.issue(baseURL+"/oauth2/v1/authsession", function(reply) {

	    	if (reply.httpStatus != 204) {
	    		postRobot.send(window.opener, 'error', { code: reply.httpStatus, error: reply.responseText});
	    	}
	    }, options);		
	});

	// Template vars
	var sessionId = $('#sessionId').html();
	var uri = $('#longPollPath').html();
	longPoll(sessionId, uri);
}

// Long poll for QRCode login
/* TODO
	- revisit when/who closes popup. We can reply to post-robot messages and popup could close itself.
	- Add window/domain args for security.
	- Change to be loop w/timeouts instead of onetime
	- Transitions/modals for demo experience ("grandma approved device, click to continue")
	- Pass subscriber info back with deviceApproved message (for display)
	- Progress bar/timeline showing steps.
	- Artificial delays/click to continue. Maybe use a separate long poll w/clicker? Make WiFi clicker with Pi Zero?
*/
function longPoll(sessionId, url) {

    var request = new XMLHttpRequest();
    var options = {method: 'POST'};

    request.body = "sessionId="+sessionId;

    request.issue(baseURL+url, function(reply) {
    	if (reply.error) {
    		// XHR error. Display error page (500), dismiss button closes window.
    		postRobot.send(window.opener, 'error', { code: 500, error: reply.error});
    	}
        else if (reply.httpStatus == 200) {
        	// Set parent window success status and close window.
        	try {
    			postRobot.send(window.opener, 'deviceApproved', JSON.parse(reply.responseText));	
        	}
        	catch(e) {
        		console.log("Long poll error. "+e+"  responseText: "+reply.responseText);
    			postRobot.send(window.opener, 'parseError', reply.responseText);		
        	}
        }
        else {
        	console.log("Failed status from server: "+reply.httpStatus+" - "+reply.responseText);
        	// HTTP error. Display error page, dismiss button closes window.
    		postRobot.send(window.opener, 'error', { code: reply.httpStatus, error: reply.responseText});
        }
    }, options);
}
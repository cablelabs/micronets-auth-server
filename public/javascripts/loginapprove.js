    
// This is the longpoll for remote logins. Only used if the client is NOT IdOra. We probably won't
// use this feature as the remote logins for the Micronets demo will only be for device-registration.html
function onLoad(url, sessionId) {
    var params = "sessionId="+sessionId;
    var http = new XMLHttpRequest();
    http.open("POST", url, true);

    //Send the proper header information along with the request
    http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

    http.onreadystatechange = function() {//Call a function when the state changes.
        if(http.readyState == 4 && http.status == 200) {
            window.location = http.responseText;
        }
    }
    http.send(params);
}
    

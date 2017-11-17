# IdOra OAuth2 Authorization and Protected Resource Server Examples

APIs that a website needs to expose for integration with IdOra and associated examples that can be changed by the website.

## Authorization Endpoints (authorizationServer.js)

### `app.get('/loginapprove')`

Request access token. If the client IS NOT IdOra, a QRC is created on the response page encoding the JSON
```javascript
{
	sessionId: unique session identifier,
	domain: domain of endpoint used by IdOra for user authentication
}
```

### `app.post('/idoraxhr')`

Long poll URL used by web apge supporting IdOra authentication

### `app.post('/authsession')`

Used by IdOra to authenticate a session (identified by `sessionId` form data) that had been previously created by a call to `app.get('/loginapprove')`.

### `app.post('/token')`

Request by client to 

1. Exchange OAuth2 authorization code for access token
2. Use a refresh_token to generate a new access token


### `app.post('/introspect')`

Used by protected resource to verify access_token and retrieve information associated with the access token.

### `app.post('/revoke')`

Revoke an access token.

## Resource Endpoints (protectedResource.js)

### `app.post('/resource')`

Return a protected resource for a previously generated acces token. The access token contains:

```javascript
{
	username: user id used when authenticating with the Auth server
	sub: unique token created when the user authenticated for this access token
	scope: permitted use of the resource
}
```

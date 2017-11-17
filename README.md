# IdOra OAuth2 Authorization and Protected Resource Server Examples

APIs that a website needs to expose for integration with IdOra and associated examples that can be changed by the website.

## Authorization Endpoints (authorizationServer.js)
### `app.get('/loginapprove')`

API to request access token. If the client IS NOT IdOra, a QRC is created on the response page encoding the JSON
`{sessionId: unique session identifier, domain: domain of endpoint used by IdOra for user authentication}`

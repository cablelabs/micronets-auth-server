# Micronets Authorization Server (auth-server)

Migrated from ssh://git@code.cablelabs.com:7999/IdOra/AuthResourceEndpoints.git
   - Original work by Bob Lund
   - Adapted/pruned to meet specific needs of Micronets POC
     + Removed micronets-protectedResource.js: We are using a registration token provided by the mso-portal to access
       the device credentials.
     + Renamed to micronets-auth-server to match other modules in the micronets project
     + Removed obsolete code (wasn't used prior to adaptation)
     + Removed non-micronets specific code for resource tokens.

## API

The exposed API is separated into two routes:
* `/` Browser based endpoints
* `/oauth2/v1/` OAUTH token management

### Register Device:

* The device metadata has been forwarded via redirect from the Registration Server.
* A registration token is obtained from the MSO Portal
* A webpage is displayed that contains the device metadata and a QRCode for the subscriber to scan
* A long poll `/idorahxr` is established by the webpage javascript, waiting for remote login via QRCode
* When the QRCode is scanned, the Authorization Server will receive an `auth-session` from the Idora Server
* Subscriber metadata data is obtained from the MSO portal
* The request is completed by redirected back to the registration server

Origin: Redirect from Registration Server

Method: GET

#### url: `/register-device`

Header Fields:
(none)

Query Params:

```
    {
      "deviceName": "ProtoMed 2",
      "vendor": "AcmeMeds",
      "modelUID64": "BQ0LDQsMDAM",
      "macAddress": "B8:27:EB:D8:DF:30",
      "deviceConnection": "wifi",
      "deviceID": "ecea43279f2b5e89d3d49537c194b956f4863612606f8a2039fca7ac64b61de1",
      "model": "Heart-Assure",
      "modelUID64": "BQ0LDQsMDAM",
      "type": "Heartrate Monitor",
      "class": "Medical",
      "serial": "AH-64B61DE1",
      "modelUID64": "CQQPBgMCCwk",
      "mudURL": "https://alpineseniorcare.com/micronets-mud/CQQPBgMCCwk",
      "redirect_uri": "portal/pair-device"
    }

```
#### response:

Request is redirected to the caller with the following params

```
    {
      "subscriberID": "123456",
      "registrationToken": "a very long string (JWT)",
      "ssid": "Grandma's SSID",
      "redirect_uri": "portal/pair-device"
    }
```

### Long Poll:
* Browser waits with a long poll for remote login

Origin: `register-device` web page

Method: POST

#### url: `/idoraxhr`

Header Fields:
(none)

POST data:

```
  {
    "sessionId": "52525252555252525252"
  }
```

#### response:
If remote login succeeds, a 200 OK is returned.


### OAUTH Authorize:

* A web page is displayed requesting that the subscriber login to authorize IdOra to obtain and retain an access token that can be used in the future for the purposes of remote login to pages presented by the MSO.

Origin: Redirect from Idora Server

Method: GET

#### url: `/oauth2/v1/authorize`

Header Fields:
(none)

Query Params:

```
    ?response_type=code
```

#### response:

200 is returned with the rendered login screen.


### Submit Authorization:
* A username/password is submitted for authentication

Origin: Form submission from `/v1/authorize` page

Method: POST

#### url: `/oauth2/v1/submitauthorize`

Header Fields:
(none)

POST data:

```
  {
    "username": "fred",
    "password": "flerb",
    "approve" " "true",
    "reqid": "5555555"
  }
```

#### response:

User is redirected back to the IdOra Server with an OAUTH code that can be exchanged for an access token.

### Token:
* A previously returned code is exchanged for an access token

Origin: IdOra Server

Method: POST

#### url: `/oauth2/v1/token`

Header Fields:
```authorization: (basic, containing IdOra clientID and client secret)
```
(Note: alternatively, clientID and client secret can be passed in POST body)

POST data:

```
  # Only if not passed in authorization header
  {
    "client_id": "52525252555252525252",
    "client_secret": "IdOra Server Secret",
    "approve" " "true",
    "reqid": "5555555"
  }
```

#### response:

Token is generated and stored in database.
Token is returned to IdOra Server, where it is stored on behalf of the subscriber

### Authorize Session:
* A user is remotely logged in

Origin: IdOra Server

Method: POST

#### url: `/oauth2/v1/authsession`

Header Fields:
```authorization: (bearer, containing subscriber access token)
```
POST data:

```
  {
    "sessionID": "123456", # session ID is embedded in QRCode
    "username": "grandma"
  }
```

#### response:
Long poll for subscriber login is returned 200 OK
Response for `/v1/authsession` is returned 200 OK


### Revoke:
* A subscriber's access token is revoked

Origin: IdOra Server

Method: POST

#### url: `/oauth2/v1/revoke`

Header Fields:
```authorization: (basic, containing IdOra clientID and client secret)
```
POST data:

```

  {
    "client_id": "52525252555252525252",   # Only if not passed in authorization header
    "client_secret": "IdOra Server Secret",   # Only if not passed in authorization header
    "access_token": "<access token to revoke>", # Optional
    "refresh_token": "<refresh token to revoke>", # Optional
    "reqid": "5555555"
  }
```

#### response:
Long poll for subscriber login is returned 200 OK
Response for `/v1/authsession` is returned 200 OK

## Build
Edit `package.json` to be sure the docker remote registry URL is correct for the `docker_publish` script

```  "scripts": {
    "start": "node ./auth-server",
    "docker-build": "docker build -t community.cablelabs.com:4567/micronets-docker/micronets-auth-server .",
    "docker-publish": "docker login community.cablelabs.com:4567; docker push community.cablelabs.com:4567/micronets-docker/micronets-auth-server"
  },
```
Install packages, build and publish:
```
  npm install
  npm run docker_build
  npm run docker_publish
```
## Deploy
The Micronets Authorization Server is deployed as a docker container.
Docker deployment instructions can be found [here](https://github.com/cablelabs/micronets/wiki/Docker-Deployment-Guide)

The environment variables to be passed to the authorization server are:
```
   -e auth_server_url=<url>  # our public URL
   -e mso_portal_url=<url>
   -e idora_server_url=<url>
   -e reg_server_url=<url>
   -e PORT=3020              # port to listen on
```

## Example run command
```
docker run -d --name=micronets-auth-server -e auth_server_url=https://mycable.co/auth -e mso_portal_url=http://45.79.13.192:3210 -e idora_server_url=https://mycable.co/idora -e reg_server_url=https://alpineseniorcare.com/micronets -p 3020:3020 -e PORT=3020 community.cablelabs.com:4567/micronets-docker/micronets-auth-server:latest
```

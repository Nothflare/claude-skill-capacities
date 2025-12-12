Title: Capacities Docs

URL Source: https://docs.capacities.io/developer/x-callback-urls

Markdown Content:
X-Callback-URLs to Capacities [​](https://docs.capacities.io/developer/x-callback-urls#x-callback-urls-to-capacities)
---------------------------------------------------------------------------------------------------------------------

> X-Callback-URLs are a way to communicate with the desktop app or mobile app. You are calling the app at specific URLs to perform actions or return specific information.

INFO

X-Callback-URLs are great but we recommend to use the [Capacities API](https://docs.capacities.io/developer/api) when possible. It's more stable and offers a wider range of functions.

General guidelines [​](https://docs.capacities.io/developer/x-callback-urls#general-guidelines)
-----------------------------------------------------------------------------------------------

X-Callback-URLs must have the following structure:

```
capacities://x-callback-url/<action>?
  x-source=SourceApp&
  x-success=sourceapp://x-callback-url/response&
  x-error=sourceapp://x-callback-url/error
```

with **required** parameters:

*   `<action>`: action you want to perform (see below)

and **optional** parameters:

*   `x-source`: name of the app calling the action
*   `x-success`: URL to call if the action was successful (needs to be a deeplink URL to the calling application)
*   `x-error`: URL to call if the action failed (needs to be a deeplink URL to the calling application)

If you want to receive the result of the action, you need to provide a `x-success` and `x-error` URL.

Error handling [​](https://docs.capacities.io/developer/x-callback-urls#error-handling)
---------------------------------------------------------------------------------------

If an error occurs, Capacities will call the `x-error` URL with the following parameters:

*   `x-source`: "Capacities"
*   `error-code`: the error code (404, 500, etc.)
*   `error-message`: a human readable error message

Testing [​](https://docs.capacities.io/developer/x-callback-urls#testing)
-------------------------------------------------------------------------

Run a X-Callback-Url like this in the Terminal:

bash

`open "capacities://x-callback-url/createNewObject?name=Test"`

You can also simply paste the URL into the address bar of your browser.

Actions [​](https://docs.capacities.io/developer/x-callback-urls#actions)
-------------------------------------------------------------------------

### `createNewObject`[​](https://docs.capacities.io/developer/x-callback-urls#createnewobject)

Opens the app and creates a new object based on the following parameters (all parameters need to be provided as query parameters):

*   `spaceId` (optional): If no spaceId is provided the current or last active space will be used.
*   `type` (optional): The type need to be the exact spelling of the singular name of your object type. If no type is provided a page will be created.
*   `title` (optional): title of the object (can be empty)
*   `content` (optional): Content needs to be provided in markdown format. It will be appended to the objects first blocks property (if available).

Example:

`capacities://x-callback-url/createNewObject?name=My%20new%20object`

capacities://x-callback-url/createNewObject?name=My%20new%20object

If something fails, the `x-error` URL will be called with the error code `501`. Otherwise, the `x-success` URL will be called with the following parameters:

*   `x-source`: "Capacities"
*   `url`: deeplink url to the object
*   `title`: title of the active object (can be empty)

### `appendToDailyNote`[​](https://docs.capacities.io/developer/x-callback-urls#appendtodailynote)

Opens the app and appends the provided content to today's daily note (all parameters need to be provided as query parameters):

*   `spaceId` (optional): If no spaceId is provided the current or last active space will be used.
*   `content`: Content needs to be provided in markdown format.

Example:

`capacities://x-callback-url/appendToDailyNote?content=My%20content`

capacities://x-callback-url/appendToDailyNote?content=My%20content

If something fails, the `x-error` URL will be called with the error code `501`. Otherwise, the `x-success` URL will be called with the following parameters:

*   `x-source`: "Capacities"
*   `url`: deeplink url to todays daily note

### `getCurrentObject`[​](https://docs.capacities.io/developer/x-callback-urls#getcurrentobject)

Returns the object that is currently opened in Capacities. If there is no active object, the `x-error` URL will be called with the error code `501`. Otherwise, the `x-success` URL will be called with the following parameters:

*   `x-source`: "Capacities"
*   `url`: deeplink url to the object
*   `title`: title of the active object (can be empty)
*   `name`: title of the active object (can be empty)

Example:

`capacities://x-callback-url/getCurrentObject?x-source=SourceApp&x-success=sourceapp://x-callback-url/response&x-error=sourceapp://x-callback-url/error`

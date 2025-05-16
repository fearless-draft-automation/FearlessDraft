# Admin API
There are several admin API endpoints that allow you to edit a live draft.

## Authorization
APIs are protected by a simple token-based authorization.

You need to sent a valid API token as a valid bearer token.
```
Authorization: Bearer my_api_token
```

### Error Codes
* 400 - Invalid `Authorization` header
* 401 - `Authorization` header was not found
* 403 - API token was not recognized

## Methods
### GET /api/admin/draft/{{draft_id}}/live
Returns the current in-memory representation of a live draft.

#### Sample Response
```
{
    "id": "kyn1ZyBK",
    "blueTeamName": "Team 1",
    "redTeamName": "Team 2",
    "blueReady": false,
    "redReady": false,
    "picks": [],
    "fearlessBans": [],
    "started": false,
    "matchNumber": 1,
    "sideSwapped": false,
    "finished": false,
    "lastActivity": 1747372436153,
    "isLocking": false,
    "nicknames": [
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        ""
    ],
    "pickTimeout": 30
}
```

#### Error Codes
* 404 - Live draft not found

### PATCH /api/admin/draft/{{draft_id}}/live

Allows to directly update **any** field of a live draft.

It directly assings fields from the body so be **EXTREMELY CAREFUL** when using it. When possible, you specialized methods instead.

#### Sample Request
```
{
    "pickTimeout": 45
}
```

#### Sample Response
```
{
    "id": "kyn1ZyBK",
    "blueTeamName": "Team 1",
    "redTeamName": "Team 2",
    "blueReady": false,
    "redReady": false,
    "picks": [],
    "fearlessBans": [],
    "started": false,
    "matchNumber": 1,
    "sideSwapped": false,
    "finished": false,
    "lastActivity": 1747372436153,
    "isLocking": false,
    "nicknames": [
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        ""
    ],
    "pickTimeout": 45
}
```

#### Error Codes
* 404 - Live draft not found

### PUT /api/admin/draft/{{draft_id}}/live/nickname/{{player_index}}

Updates nickname of a specific player. `player_index` is a zero-based array index of an element from `nicknames` array.

#### Sample Request
```
{
    "nickname": "replacement_1"
}
```

#### Sample Response
```
{
    "id": "kyn1ZyBK",
    "blueTeamName": "Team 1",
    "redTeamName": "Team 2",
    "blueReady": false,
    "redReady": false,
    "picks": [],
    "fearlessBans": [],
    "started": false,
    "matchNumber": 1,
    "sideSwapped": false,
    "finished": false,
    "lastActivity": 1747372436153,
    "isLocking": false,
    "nicknames": [
        "",
        "replacement_1",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        ""
    ],
    "pickTimeout": 45
}
```

#### Error Codes
* 400 - Invalid player index
* 404 - Live draft not found

### PUT /api/admin/draft/{{draft_id}}/live/pick/{{pick_ban_index}}

Updates specific pick/ban. `pick_ban_index` is an encoded position of a target replacement. The first letter is a side, the second is a ban/pick sign and the third is a 1-based index of a slot. For example
* BP1 - first pick of a blue team
* RB3 - third band of a red team

Method does a number of validations to ensure an update makes sense:
* replacement champion should not be picked
* pick slot should be active i.e. someone should have finished the pick
* replacement should be a valid champion key

#### Sample Request
```
{
    "pick": "ambessa"
}
```

#### Sample Response
```
{
    "id": "kyn1ZyBK",
    "blueTeamName": "Team 1",
    "redTeamName": "Team 2",
    "blueReady": false,
    "redReady": false,
    "picks": [
        "akali",
        "akshan",
        "alistar",
        "zoe",
        "amumu",
        "ahri",
        "ambessa",
        "aurelionsol",
        "blitzcrank",
        "braum",
        "brand",
        "vi",
        "warwick",
        "varus",
        "veigar",
        "vayne",
        "vex",
        "viego",
        "viktor",
        "vladimir"
    ],
    "fearlessBans": [],
    "started": false,
    "matchNumber": 2,
    "sideSwapped": false,
    "finished": false,
    "lastActivity": 1747373353076,
    "isLocking": false,
    "nicknames": [
        "",
        "replacement_1",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        ""
    ],
    "pickTimeout": 45
}
```

#### Error Codes
* 400 - Invalid update request. See internal error for details
* 404 - Live draft was not found
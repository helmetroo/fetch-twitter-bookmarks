# fetch-twitter-bookmarks

**CLI tool that fetches your Twitter bookmarks and save them to a file**

* **[Goals](#goals)**
* **[How it works](#how-it-works)**
** **[Initial approach](#initial-approach)**
* **[Feedback](#feedback)**
* **[Requirements](#requirements)**
* **[Installation](#installation)**
** **[Globally](#install-globally)**
** **[Locally](#install-locally)**
* **[Usage](#usage)**
** **[Arguments](#arguments)**

<a name="goals"></a>

# Goals
- Be a means to fetch your bookmarks without needing Twitter's developer API
- Fetch bookmarks using a means as reliable and sturdy as possible (this tool should work on its own without making many changes, for as long as possible)

<a name="how-it-works"></a>

# How it works
At the moment, Twitter offers no means through their current API for developers allowing you to fetch your bookmarks. I'm aware [their team is working on it](https://twittercommunity.com/t/twitter-bookmarks-not-accessible-via-the-api/142160), though.

1. To work around this, this tool makes HTTP requests on your behalf to Twitter. You'll be prompted for your credentials, either by providing them as command-line arguments or interactively.
2. If your account has 2FA enabled, you'll then be prompted for your authentication code.
3. Upon successfully logging in, the tool will fetch the bookmarks page using the returned cookies and session info from step 1. The bookmarks page references a script called ``main.XXXXXXXXX.js`. Pages on Twitter use an exposed GraphQL API to fetch data for their display. In order to make use of this API, a unique query ID must be provided as part of the URL path (see below). The script mentioned earlier has JS objects containing information about this type of query, following this exact pattern:

```json
{queryId:"$QUERY_ID",operationName:"Bookmarks",operationType:"query"}
```

The URL pattern for accessing these resources through this API is 
`https://twitter.com/i/api/graphql/$QUERY_ID/$OPERATION_NAME?variables=$QUERY_PARAMETERS`

The query parameter `variables` is url-encoded JSON, and represents the query parameters. For convenience, and to doubly make sure the tool presents like a browser to Twitter, the very same parameters the bookmarks page already passes to the query are used.

<a name="initial-approach"></a>

# Initial approach

An earlier method used a scraper-based approach with Puppeteer to use an actual browser to visit the bookmarks page on your behalf, continuously scrolling down and scraping encountered tweets, assuming Twitter always wraps them in `<article />` elements. To see how that worked and the implementation for that approach, [take a look here](https://github.com/helmetroo/fetch-twitter-bookmarks/tree/1232e7aa308e65e8b80f6fbf4bf928575194edf1). I decided that approach was far too malleable and complex.

<a name="feedback"></a>

# Feedback

Thoughts on this project? Have ideas for a better approach? I'd love to hear them. Open an issue for this project or email me.

<a name="requirements"></a>

# Requirements

I've only run this on the following node and npm versions. There's a chance it may run on earlier versions, but I haven't tested this.

- `node` >= 14.x
- `npm` >= 7.x

<a name="installation"></a>
## Installation

<a name="install-globally"></a>
### Install globally

Install as a global npm module.

```bash
npm i -g https://github.com/helmetroo/fetch-twitter-bookmarks.git
```

<a name="install-locally"></a>
### Install locally

1. Clone this repo.

```bash
git clone https://github.com/helmetroo/fetch-twitter-bookmarks.git
```

2. Install all required modules.

```bash
npm i
```

A one-liner for the above.
```bash
git clone https://github.com/helmetroo/fetch-twitter-bookmarks.git && npm i
```

<a name="usage"></a>
## Usage
If installed globally, you can run it like:
```
fetch-twitter-bookmarks --username="$TWITTER_USERNAME" --password="$TWITTER_PASSWORD" --cursor="$CURSOR" --maxLimit=$MAX_LIMIT --fileName="$FILE_NAME" --output="json"
```

If you're inside the project folder, you can run it via one of two ways.
```bash
npm start -- --username="$TWITTER_USERNAME" --password="$TWITTER_PASSWORD" --cursor="$CURSOR" --maxLimit=$MAX_LIMIT --fileName="$FILE_NAME" --output="json" 
```

```bash
./bin/main.js -- --username="$TWITTER_USERNAME" --password="$TWITTER_PASSWORD" --cursor="$CURSOR" --maxLimit=$MAX_LIMIT --fileName="$FILE_NAME" --output="json" 
```

### Arguments
Below are the accepted command line arguments for this tool.

| Argument   | Description                                                                                                                                                                                                                                                            |
| :--        | :--                                                                                                                                                                                                                                                                    |
| `username` | (optional): Your Twitter phone, username or email. If not provided as an argument, you'll be prompted for it.                                                                                                                                                          |
| `password` | (optional): Your Twitter password. If not provided as an argument, you'll be prompted for it.                                                                                                                                                                          |
| `cursor`   | (optional): A string representing the point to begin fetching bookmarks from. Useful if something went wrong whilst fetching, and you need to continue fetching where you left off.                                                                                    |
| `maxLimit` | (optional): The maximum number of bookmarked tweets to fetch. Must be an integer. If not provided, the tool will fetch all the bookmarks it can.                                                                                                                       |
| `fileName` | (optional, required if `output` is not `stdout`): The filename where the tool will save your fetched tweets to. Filenames can be absolute or relative. If relative, they will be resolved relative to your current working directory. Ignored if `output` is `stdout`. |
| `output`   | (optional): The format tweets should be exported to. Defaults to `json`. Available formats are `json`, `stdout`.                                                                                                                                                       |

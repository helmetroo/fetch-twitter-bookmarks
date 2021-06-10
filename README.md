# fetch-twitter-bookmarks

**Interactive CLI application that fetches your Twitter bookmarks and saves them to a file**

* **[Goals](#goals)**
* **[How it works](#how-it-works)**
* **[Notes](#notes)**
* **[How to use](#how-to-use)**
  * **[Requirements](#requirements)**
  * **[Installation](#installation)**
  * **[Running](#running)**
  * **[Testing](#testing)**
* **[Initial approach](#initial-approach)**
* **[Feedback](#feedback)**

<a name="goals"></a>
# Goals

- Be a means to fetch your bookmarks without needing Twitter's developer API
- Fetch bookmarks using a means as reliable and sturdy as possible (this tool should work on its own without making many changes, for as long as possible)

<a name="how-it-works"></a>
# How it works
At the moment, Twitter offers no means through their current API for developers allowing you to fetch your bookmarks. I'm aware [their team is working on it](https://twittercommunity.com/t/twitter-bookmarks-not-accessible-via-the-api/142160), though.

1. To work around this, this application pretends to be you by logging in as you to Twitter's site through a headless browser, powered by [playwright](https://playwright.dev/). Playwright offers different browsers to do this with, choices include: `chromium`, `firefox` and `webkit`.
2. If Twitter prompts you for a code to log in (either because you have 2FA turned on or because they suspect a "suspicious" login), you'll then be prompted for your authentication code.
3. Upon successfully logging in, the application looks for information found in the bookmarks page. This page references a script called `main.XXXXXXXXX.js`. Pages on Twitter use an exposed GraphQL API to fetch data for their display. In order to make use of this API, a unique query ID must be provided as part of the URL path (see below). The script mentioned earlier has JavaScript objects containing information about the type of queries. Each object follows this pattern:

```javascript
{queryId:"$QUERY_ID",operationName:"Bookmarks",operationType:"query"}
```

The URL pattern for accessing these resources through this API is 
`https://twitter.com/i/api/graphql/$QUERY_ID/$OPERATION_NAME?variables=$QUERY_PARAMETERS`

The query parameter `variables` is url-encoded JSON, and represents the query parameters. For convenience, and to doubly make sure the tool presents like a browser to Twitter, the very same parameters the bookmarks page already passes to the query are used.

<a name="notes"></a>
# Notes

Because this application uses a headless browser to pretend to be you to log in on your behalf, you'll receive login notifications like the ones I did below. This is expected. When you run [tests](#testing), you may see several of these.

![Login notifications](./images/login-notifications.png)

<a name="how-to-use"></a>
# How to use

<a name="requirements"></a>
## Requirements

I've only run this on the following node and npm versions, on Windows 10 with WSL2 running Ubuntu. 
There's a chance it may run on earlier versions, but I haven't tested this.

* `node` >= 14.x
* `npm` >= 7.x
* A TTY-capable terminal. 
  Quickly check this by running ```node -e "console.log(process.stdout.isTTY)"```. 
  If it prints `true`, you're set.

<a name="installation"></a>
## Installation

1. From a directory of your choice, clone this repo with
```bash
git clone https://github.com/helmetroo/fetch-twitter-bookmarks.git
```

2. Change into the newly created directory, and install all the required modules.
```bash
cd fetch-twitter-bookmarks

npm i
```

<a name="running"></a>
## Running
The application is an interactive shell that accepts commands, powered by [Vorpal](https://vorpal.js.org/). 

You can run the `help` command at any time for help on commands available to you at the current moment.

Run the application with
```bash
npm start
```

1. First, you'll need to choose the browser you want to use to act as you to login to Twitter. Run the command `browser $BROWSER`. `$BROWSER` can be any one of the available browser choices for your machine, which you can see with `help`.
2. After you've set the browser, you can now `login` (alias `authenticate`). You'll be prompted for your credentials. If you successfully logged in, you'll see a success message, otherwise, you may be prompted for an additional code (2FA or other identification code Twitter asks you to continue logging in to make sure it's you)
3. When you're finished, you can either end your session with `end` (alias `close`), if you want to choose a different browser, or you can `exit` the application entirely. Both commands will log you out first if you had already signed in.

<a name="testing"></a>
## Testing
Currently working functionality uses Jest to run tests against it. All tests are run against every browser playwright can run on your machine.
Some tests require real user credentials to work. You can add these in a `.env` file in this project's root directory:

```text
FB_TWITTER_USERNAME=...
FB_TWITTER_PASSWORD=...
```

Run tests with
```bash
npm test
```
<a name="initial-approach"></a>
# Initial approach

An earlier method used a scraper-based approach entirely with Puppeteer to visit the bookmarks page on your behalf, continuously scrolling down and scraping encountered tweets, assuming Twitter always wrapped them in `<article />` elements. To see how that worked and the implementation for that approach, [take a look here](https://github.com/helmetroo/fetch-twitter-bookmarks/tree/1232e7aa308e65e8b80f6fbf4bf928575194edf1). I decided that approach was far too malleable and complex.

<a name="feedback"></a>
# Feedback

Thoughts on this project? Have ideas for a better approach? I'd love to hear them. Open an issue for this project or email me.

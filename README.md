# extract-twitter-bookmarks

**CLI tool that uses Puppeteer to download your Twitter bookmarks and save them to a JSON file**

* **[How it Works](#how-it-works)**
* **[Requirements](#requirements)**
* **[Install](#install)**
* **[Usage](#usage)**

<a name="how-it-works"></a>

# How it Works

At the moment, Twitter doesn't have an API that allows you to fetch your bookmarks. Bookmarks are also only available through the mobile app, or by visiting the mobile version of Twitter's site (https://m.twitter.com). 

To counter this, this tool uses Puppeteer to act as a user to log in to the mobile Twitter site, navigate to the bookmarks site (https://m.twitter.com/i/bookmarks), then scroll down continuously and scrape each tweet. The tool assumes tweets are wrapped in a 
```html
<article />
```
element.

<a name="requirements"></a>

# Requirements

- `node` >= 10.x
- `npm` >= 6.x


<a name="install"></a>

## Install

Clone the repo.

```bash
git clone https://github.com/helmetroo/extract-twitter-bookmarks.git 
```

Install required modules.

```bash
npm i
```

<a name="usage"></a>

## Usage

```bash
npm run start -- --username="$TWITTER_USERNAME" --password="$TWITTER_PASSWORD" --maxLimit=$MAX_LIMIT
```

- `username` (required): Your Twitter phone, username or email.
- `password` (required): Your Twitter password.
- `maxLimit` (optional): The maximum number of bookmarked tweets to fetch. Must be an integer. If not provided, the tool will fetch all the bookmarks it can, stopping when it can no longer scroll further for more tweets.

When it's finished, a JSON file called `tweets.json` will appear in the project directory containing your bookmarked tweets.

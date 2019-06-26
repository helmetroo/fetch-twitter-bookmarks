# extract-twitter-bookmarks

**CLI tool that uses Puppeteer to download your Twitter bookmarks and save them to a JSON file**

* **[How it Works](#how-it-works)**
* **[Requirements](#requirements)**
* **[Install globally](#install-globally)**
* **[Install locally](#install-locally)**
* **[Usage](#usage)**

<a name="how-it-works"></a>

# How it Works

At the moment, Twitter doesn't have an API that allows you to fetch your bookmarks. Bookmarks are also only available through the mobile app, or by visiting the mobile version of Twitter's site (https://m.twitter.com). 

To work around this, this tool uses Puppeteer to act as a user to log in to the mobile Twitter site, navigate to the bookmarks page (https://m.twitter.com/i/bookmarks), then scroll down continuously and scrape each tweet. If there is an issue encountered as the tool scrolls for tweets, the tool will automatically click a "Try again" button to keep going. The tool assumes tweets are wrapped in an ```<article />``` element.

<a name="requirements"></a>

# Requirements

- `node` >= 10.x
- `npm` >= 6.x


<a name="install-globally"></a>

## Install globally

Install as a global npm module.

```bash
npm i -g https://github.com/helmetroo/extract-twitter-bookmarks.git
```

<a name="install-locally"></a>

## Install locally

1. Clone this repo.

```bash
git clone https://github.com/helmetroo/extract-twitter-bookmarks.git
```

2. Install all required modules.

```bash
npm i
```

You can do it in one line.
```bash
git clone https://github.com/helmetroo/extract-twitter-bookmarks.git && npm i
```

<a name="usage"></a>

## Usage
If installed globally, you can run it like:
```
extract-twitter-bookmarks --username="$TWITTER_USERNAME" --password="$TWITTER_PASSWORD" --maxLimit=$MAX_LIMIT --fileName="$FILE_NAME" --silent
```

If you're inside the project folder, you can run it via one of two ways.
```bash
./bin/main.js -- --username="$TWITTER_USERNAME" --password="$TWITTER_PASSWORD" --maxLimit=$MAX_LIMIT --fileName="$FILE_NAME" --silent
```

```bash
npm run start -- --username="$TWITTER_USERNAME" --password="$TWITTER_PASSWORD" --maxLimit=$MAX_LIMIT --fileName="$FILE_NAME" --silent
```

When finished, tweets are printed to STDOUT, unless you add the `silent` argument (see more information below). 
If `fileName` is provided as an argument, the tool will save your fetched tweets to the file under the filename you provide (see `fileName` option below for how this works).

| Parameter  | Description                                                                                                                                                                                                     |
| :--        | :--                                                                                                                                                                                                             |
| `username` | (optional): Your Twitter phone, username or email. If not provided as an argument, you'll be prompted for it.                                                                                                   |
| `password` | (optional): Your Twitter password. If not provided as an argument, you'll be prompted for it.                                                                                                                   |
| `maxLimit` | (optional): The maximum number of bookmarked tweets to fetch. Must be an integer. If not provided, the tool will fetch all the bookmarks it can, stopping when it can no longer scroll further for more tweets. |
| `fileName` | (optional): The filename where the tool will export your fetched tweets to. Filenames can be absolute or relative. If relative, they will be resolved relative to your current working directory.               |
| `silent`    | (optional): If provided, tweets will not be printed to STDOUT. You'll need to provide `fileName` if set.                                                                      |

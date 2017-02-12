# npm-dependency-db

Use `npm-dependency-db` to list which npm packages depends on a given
version (or version range) of a given npm package.

[![Build status](https://travis-ci.org/watson/npm-dependency-db.svg?branch=master)](https://travis-ci.org/watson/npm-dependency-db)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard)

A hosted web version of this module exists at:
[dependency.land](https://dependency.land).

## Installation

```
npm install npm-dependency-db -g
```

### Upgrading from previous versions

#### Version 4

If you are upgrading from version 4, you should reset the dependency-db
database by deleting the `~/.npm-dependency-db/dependency-db` folder and
then re-index the data by running `npm-dependency-db --update
--indexOnly`.

#### Version 3

If you are upgrading from version 3, you can avoid re-downloading
all the data by performing the following commands:

```
mv ~/.npm-dependency-db ~/.npm-dependency-db.tmp
mkdir ~/.npm-dependency-db
mv ~/.npm-dependency-db.tmp ~/.npm-dependency-db/hypercore
npm-dependency-db --update --indexOnly
```

#### Version &lt;3

If you are upgrading from versions older than v3, you need to completely
purge the cache by deleting the entire `~/.npm-dependency-db` directory
and reimport everything by running `npm-dependency-db --update`.

## CLI Usage

```
npm-dependency-db [<name> [range]] [options]
```

First time you use `npm-dependency-db` you need to sync the npm
dependency tree to a local cache by running:

```
$ npm-dependency-db --update
```

Do this every time you want to get up-to-date with the latest changes
from the npm database.

To perform a query, run:

```
$ npm-dependency-db <name> [range] [options]
```

Where `<name>` is a name of the module you want to query and `[range]`
is an optional semver range similar to what you would write in a
package.json file.

E.g. to ask who depends on bluebird within the 2.x version range, you
could run:

```
$ npm-dependency-db bluebird 2.x
```

E.g. to ask who depends on standard as a dev-dependency within the 7.x
version range, you could run:

```
$ npm-dependency-db --dev standard 7
```

Run with `--help` option to see a complete list of options.

## Programmatic Usage

```js
var Updater = require('npm-dependency-db/updater')
var level = require('level')

var db = level('./test.db')

var updater = new Updater(db, {live: true})

updater.on('processed', function (n) {
  console.log('processed npm change number %d', n)
})
```

## API

### `Updater(db[, options])`

Initialize the `Updater` with a LevelDB compatible database and an
optional `options` object.

The following options are supported:

- `key` - The hypercore key to create a feed from. Will default to a
  hard-coded key
- `live` - If `true`, the feed will be kept open while waiting for new
  changes. Ignored if `indexOnly` is `true`. Defaults to `false`
- `npmDb` - Set to a levelDB instance to use separate levelDB to store
  the raw npm feed. This will allow you to delete the indexed levelDB
  database without having to re-download the entire npm feed
- `indexOnly` - Only build database index (do not download new blocks).
  Defaults to `false`

### `Event: init`

Emitted when `updater.processed`, `updater.startBlock` and
`updater.currentBlock` have been populated.

### `Event: running`

Emitted when the `updater.feed` starts flowing.

### `Event: processed`

Emitted when a change object have been completely processed.

The first argument is the hypercore block number containing the change
that have been processed.

### `Event: end`

Emitted when there is nothing more to process. Will not be emitted if
`options.live` is `true` unless an error occurs.

### `Event: error`

Emitted if an error occurs.

The first arguemnt is the error.

### `updater.feed`

A hypercore feed. Contains all npm change objects. Each change is a
block in the feed.

### `updater.startBlock`

The change (i.e. hypercore block number) where the feed will start to
process in this instance of the `Updater`.

### `updater.currentBlock`

The change (i.e. hypercore block number) that is currently beeing
processed.

### `updater.feedLength`

The number of changes in the feed.

Gotcha: This number will grow if changes are discovered while the
`Updater` is running.

### `updater.remaining`

The number of changes left to process in the feed.

Gotcha: This number will grow if changes are discovered while the
`Updater` is running.

### `updater.processed`

The number of changes processed so far in the feed.

## License

MIT

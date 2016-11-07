# npm-dependency-db

Use `npm-dependency-db` to list which npm packages depends on a given
version (or version range) of a given npm package.

[![Build status](https://travis-ci.org/watson/npm-dependency-db.svg?branch=master)](https://travis-ci.org/watson/npm-dependency-db)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard)

## Installation

```
npm install npm-dependency-db -g
```

## Usage

First time you use `npm-dependency-db` you need to sync the npm
dependency tree to a local cache by running:

```
$ npm-dependency-db --update
```

Do this every time you want to get up-to-date with the latest changes
from the npm database.

To perform a query, run:

```
$ npm-dependency-db <name> [range]
```

Where `<name>` is a name of the module you want to query and `[range]`
is an optional semver range similar to what you would write in a
package.json file.

E.g. to ask who depends on bluebird within the 2.x version range, you
could run:

```
$ npm-dependency-db bluebird 2.x
```

## License

MIT

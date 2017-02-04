#!/usr/bin/env node
'use strict'

var mkdirp = require('mkdirp')
var pkg = require('./package')

process.title = pkg.name

var argv = require('minimist')(process.argv.slice(2))
var db = require('./lib/db')(argv.db)

if (argv.update || argv.u) {
  mkdirp.sync(db.path)
  console.log('cache location:', db.path)
  require('./lib/update')(db.level(), argv)
} else if (argv.version || argv.v) {
  version()
} else if (argv.help || argv.h) {
  usage()
} else if (!db.existsSync()) {
  noCache()
} else if (argv._.length > 0) {
  console.log('cache location:', db.path)
  require('./lib/query')(db.level(), argv._[0], argv._[1], {devDependencies: argv.dev})
} else {
  usage(1)
}

function version () {
  console.log(pkg.version)
  process.exit()
}

function usage (code) {
  console.log('Usage:')
  console.log('  %s [<name> [range]] [options]', pkg.name)
  console.log()
  console.log('General options:')
  console.log('  --version, -v  output version')
  console.log('  --help, -h     output this help')
  console.log('  --db=path      specify path to local cache')
  console.log()
  console.log('Updating options:')
  console.log('  --update, -u   update the local cache')
  console.log('  --live         don\'t exit the program to keep seeding')
  console.log('  --key=key      use custom hypercore key')
  console.log()
  console.log('Query options:')
  console.log('  --dev          query dev-dependencies')
  console.log()
  console.log('Examples:')
  console.log('  %s --update', pkg.name)
  console.log('  %s bluebird ^2.0.0', pkg.name)
  console.log('  %s standard 7 --dev', pkg.name)
  process.exit(code || 0)
}

function noCache () {
  console.log('ERROR: Could not find a local cache at', db.path)
  console.log()
  console.log('Ensure that you update the local cache at least once via:')
  console.log('  %s --update', pkg.name)
  console.log()
  console.log('This will take a while!')
  process.exit(1)
}

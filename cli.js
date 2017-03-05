#!/usr/bin/env node
'use strict'

var mkdirp = require('mkdirp')
var pkg = require('./package')

process.title = pkg.name

var argv = require('minimist')(process.argv.slice(2))
var db = require('./lib/db')(argv.db)

if (argv.update || argv.u) {
  mkdirp.sync(db.root)
  console.log('cache location:', db.root)
  argv.npmDb = db.hypercore()
  require('./lib/update')(db.depdb(), argv)
} else if (argv.version || argv.v) {
  version()
} else if (argv.help || argv.h) {
  usage()
} else if (!db.existsSync()) {
  noCache()
} else if (argv._.length > 0) {
  if (!argv.csv) console.log('cache location:', db.root)
  require('./lib/query')(db.depdb(), argv._[0], argv._[1], argv)
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
  console.log('  --version, -v  Output version')
  console.log('  --help, -h     Output this help')
  console.log('  --db=path      Specify path to local cache')
  console.log()
  console.log('Updating options:')
  console.log('  --update, -u   Update the local cache')
  console.log('  --live         Don\'t exit the program to keep seeding')
  console.log('  --key=key      Use custom hypercore key')
  console.log('  --indexOnly    Build database index only (no downloading)')
  console.log()
  console.log('Query options:')
  console.log('  --csv          Output results in CSV format')
  console.log('  --dev          Query dev-dependencies')
  console.log('  --all          Return all versions of all packages that matches the queried')
  console.log('                 dependency')
  console.log('  --outdated     Return the highest version of each package that matches the')
  console.log('                 queried dependency (even if they aren\'t the most recent).')
  console.log('                 Ignored if --all is used')
  console.log()
  console.log('Examples:')
  console.log('  %s --update', pkg.name)
  console.log('  %s bluebird ^2.0.0', pkg.name)
  console.log('  %s standard 7 --dev', pkg.name)
  process.exit(code || 0)
}

function noCache () {
  console.log('ERROR: Could not find a local cache at', db.root)
  console.log()
  console.log('Ensure that you update the local cache at least once via:')
  console.log('  %s --update', pkg.name)
  console.log()
  console.log('This will take a while!')
  process.exit(1)
}

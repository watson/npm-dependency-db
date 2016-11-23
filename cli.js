#!/usr/bin/env node
'use strict'

var pkg = require('./package')
var db = require('./lib/db')

process.title = pkg.name

var argv = require('minimist')(process.argv.slice(2))

if (argv.update || argv.u) {
  require('./lib/update')(argv)
} else if (argv.version || argv.v) {
  version()
} else if (argv.help || argv.h) {
  usage()
} else if (!db.existsSync()) {
  noCache()
} else if (argv._.length > 0) {
  require('./lib/query').apply(null, argv._)
} else {
  usage(1)
}

function version () {
  console.log(pkg.version)
  process.exit()
}

function usage (code) {
  console.log('Usage:')
  console.log('  %s <options> | <name> [range]', pkg.name)
  console.log()
  console.log('Options:')
  console.log('  --version, -v  output version')
  console.log('  --help, -h     output this help')
  console.log('  --update, -u   update the local cache')
  console.log('  --live         don\'t exit the program to keep seeding')
  console.log()
  console.log('Examples:')
  console.log('  %s --update', pkg.name)
  console.log('  %s bluebird ^2.0.0', pkg.name)
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

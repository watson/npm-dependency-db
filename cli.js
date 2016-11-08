#!/usr/bin/env node
'use strict'

var pkg = require('./package')
var db = require('./lib/db')

var cmd = process.argv[2]

if (!cmd) usage(1)

switch (cmd) {
  case '-u':
  case '--update':
    require('./update')
    break
  case '-v':
  case '--version':
    version()
    break
  case '-h':
  case '--help':
    usage()
    break
  default:
    if (!db.existsSync()) noCache()
    else require('./query')
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
  console.log()
  console.log('Examples:')
  console.log('  %s --update', pkg.name)
  console.log('  %s bluebird ^2.0.0', pkg.name)
  process.exit(Number.isFinite(code) ? code : 0)
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

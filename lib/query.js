'use strict'

var semver = require('semver')
var sub = require('subleveldown')
var DepDb = require('dependency-db')

module.exports = function (db, name, range, opts) {
  range = String(range || '*')

  var depDb = new DepDb(sub(db, 'depdb'))

  if (!name) throw new Error('missing required name')

  if (!opts.csv) console.log('Looking up %s %s dependants...', name, range)

  var pkgCount = 0
  var lastName
  var lastVersion
  var lastDependency
  var results = depDb.query(name, range, {all: opts.all || opts.highest, devDependencies: opts.dev})

  results.on('error', function (err) {
    throw err
  })

  results.on('data', function (pkg) {
    if (opts.all || !opts.highest || (lastName && lastName !== pkg.name)) {
      flush()
    } else if (lastVersion && semver.lt(pkg.version, lastVersion)) {
      return
    }

    lastName = pkg.name
    lastVersion = pkg.version
    lastDependency = opts.dev ? pkg.devDependencies[name] : pkg.dependencies[name]
  })

  results.on('end', function () {
    flush()
    if (!opts.csv) console.log('Found %d results', pkgCount)
  })

  function flush () {
    if (!lastName) return
    pkgCount++
    console.log(opts.csv ? '%s,%s,%s' : '- %s@%s (dependency: %s)', lastName, lastVersion, lastDependency)
  }
}

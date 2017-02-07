'use strict'

var semver = require('semver')
var sub = require('subleveldown')
var DepDb = require('dependency-db')

module.exports = function (db, name, range, opts) {
  range = String(range || '*')

  var depDb = new DepDb(sub(db, 'depdb'))

  if (!name) throw new Error('missing required name')

  console.log('Looking up %s %s dependants...', name, range)

  var pkgCount = 0
  var uniqueCount = 0
  var lastName
  var lastVersion
  var lastDependency
  var results = depDb.query(name, range, opts)

  results.on('error', function (err) {
    throw err
  })

  results.on('data', function (pkg) {
    pkgCount++

    if (lastName && lastName !== pkg.name) {
      flush()
    } else if (lastVersion && semver.lt(pkg.version, lastVersion)) {
      return
    }

    lastName = pkg.name
    lastVersion = pkg.version
    lastDependency = opts.devDependencies ? pkg.devDependencies[name] : pkg.dependencies[name]
  })

  results.on('end', function () {
    flush()
    console.log('Found %d dependant package releases', pkgCount)
    console.log('Filtered down to %d unique packages:', uniqueCount)
  })

  function flush () {
    uniqueCount++
    console.log('- %s@%s (latest dependency: %s)', lastName, lastVersion, lastDependency)
  }
}

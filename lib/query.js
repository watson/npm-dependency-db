'use strict'

var semver = require('semver')
var DepDb = require('dependency-db')

module.exports = function (db, name, range) {
  range = String(range || '*')

  var depDb = new DepDb(db)

  if (!name) throw new Error('missing required name')

  console.log('Looking up %s %s dependants...', name, range)

  var pkgCount = 0
  var uniqueCount = 0
  var prevPkg
  var results = depDb.query(name, range)

  results.on('error', function (err) {
    throw err
  })

  results.on('data', function (pkg) {
    pkgCount++

    if (prevPkg && prevPkg.name !== pkg.name) {
      flush()
    } else if (prevPkg && semver.lt(pkg.version, prevPkg.version)) {
      return
    }

    prevPkg = pkg
  })

  results.on('end', function () {
    flush()
    console.log('Found %d dependant package releases', pkgCount)
    console.log('Filtered down to %d unique packages:', uniqueCount)
  })

  function flush () {
    uniqueCount++
    console.log('- %s@%s (latest dependency: %s)', prevPkg.name, prevPkg.version, prevPkg.dependencies[name])
  }
}

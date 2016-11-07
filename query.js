'use strict'

var path = require('path')
var levelup = require('level')
var semver = require('semver')
var Db = require('dependency-db')

var dbPath = path.join(process.env.HOME, '.' + require('./package').name)
console.log('cache location:', dbPath)
var _db = levelup(dbPath)
var db = new Db(_db)

var name = process.argv[2]
var range = process.argv[3] || '*'

if (!name) throw new Error('missing required name')

console.log('Looking up %s %s dependants...', name, range)

db.query(name, range, function (err, pkgs) {
  if (err) throw err

  console.log('Found %d dependant package releases', pkgs.length)

  var unique = {}

  pkgs.forEach(function (pkg) {
    if (!unique[pkg.name] || semver.gt(pkg.version, unique[pkg.name].version)) {
      unique[pkg.name] = {version: pkg.version, range: pkg.dependencies[name]}
    }
  })

  console.log('Filtered down to %d unique packages:', Object.keys(unique).length)

  Object.keys(unique).forEach(function (pkgName) {
    var pkg = unique[pkgName]
    console.log('- %s@%s (latest dependency: %s)', pkgName, pkg.version, pkg.range)
  })

  process.exit()
})

'use strict'

var util = require('util')
var path = require('path')
var hypercore = require('hypercore')
var levelup = require('level')
var swarm = require('hyperdrive-archive-swarm')
var Db = require('dependency-db')
var progress = require('progress-string')
var diff = require('ansi-diff-stream')()
var clean = require('normalize-registry-metadata')
var mkdirp = require('mkdirp')
var afterAll = require('after-all')
var name = require('./package').name
var debug = require('debug')(name)

var dbPath = path.join(process.env.HOME, '.' + name)
mkdirp.sync(dbPath)
console.log('cache location:', dbPath)
var _db = levelup(dbPath)
var db = new Db(_db)
var key = '503cf9e12d8ae49a07568d90f04bbdbfa3f1998ab97ed2b5143c1f3f69ec052f'
var feed = hypercore(_db).createFeed(key, {sparse: true})

var state = {
  startBlock: 0,
  total: 0,
  downloaded: 0,
  remaining: 0,
  processed: 0
}

swarm(feed)

if (!debug.enabled) diff.pipe(process.stdout)

_db.get('!last_block!', function (err, lastBlock) {
  if (err && !err.notFound) throw err

  state.startBlock = state.processed = lastBlock ? Number(lastBlock) + 1 : 0
  trackSyncing()

  feed.open(function (err) {
    if (err) throw err

    debug('chache is open')

    state.total = feed.blocks
    state.remaining = feed.blocksRemaining()
    printProgress()

    processChanges(state.startBlock)
  })
})

function processChanges (start) {
  debug('processing changes from block %d', start)

  var stream = feed.createReadStream({start: start})

  stream.on('data', function (data) {
    processChange(JSON.parse(data))
  })

  function processChange (change) {
    var doc = change.doc
    clean(doc)

    if (!doc.versions) {
      debug('skipping %s - no versions detected', change.id)
      printProgress()
      return
    }

    var next = afterAll(function (err) {
      if (err) throw err
      _db.put('!last_block!', state.processed++, function (err) {
        if (err) throw err
        printProgress()
      })
    })

    Object.keys(doc.versions).forEach(function (version) {
      var pkg = doc.versions[version]
      debug('storing %s@%s (%d dependencies)...', pkg.name, pkg.version, pkg.dependencies ? Object.keys(pkg.dependencies).length : 0)
      db.store(pkg, next())
    })
  }
}

function trackSyncing () {
  feed.on('download', function (block) {
    state.downloaded++
    if (feed.blocks !== state.total) {
      var newBlocks = feed.blocks - state.total
      state.remaining += newBlocks
      state.total = feed.blocks
    }
    printProgress()
  })
}

function printProgress () {
  var processedCounter = state.processed - state.startBlock
  var totalToProcess = state.total - state.startBlock

  var sessionBar = progress({total: state.remaining})
  var processedBar = progress({total: totalToProcess})

  diff.write(
    util.format('downloading [%s] (%d/%d)\n', sessionBar(state.downloaded), state.downloaded, state.remaining) +
    util.format('processing  [%s] (%d/%d)', processedBar(processedCounter), processedCounter, totalToProcess)
  )
}

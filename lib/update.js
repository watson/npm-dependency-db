'use strict'

var util = require('util')
var hypercore = require('hypercore')
var swarm = require('hyperdrive-archive-swarm')
var DepDb = require('dependency-db')
var progress = require('progress-string')
var diff = require('ansi-diff-stream')()
var clean = require('normalize-registry-metadata')
var transform = require('parallel-transform')
var through = require('through2')
var mkdirp = require('mkdirp')
var afterAll = require('after-all')
var pump = require('pump')
var speedometer = require('speedometer')
var prettierBytes = require('prettier-bytes')
var db = require('./db')
var debug = require('debug')(require('../package').name)

module.exports = function (opts) {
  mkdirp.sync(db.path)
  console.log('cache location:', db.path)

  var lvlDb = db.level()
  var depDb = new DepDb(lvlDb)
  var key = opts.key || '503cf9e12d8ae49a07568d90f04bbdbfa3f1998ab97ed2b5143c1f3f69ec052f'
  var feed = hypercore(lvlDb).createFeed(key)
  var downloadSpeed = speedometer()
  var processingSpeed = speedometer()

  var state = {
    startBlock: 0,
    currentBlock: 0,
    feedLength: 0,
    downloaded: 0,
    bps: 0,
    pps: 0,
    remaining: 0,
    processed: 0
  }

  swarm(feed)

  if (!debug.enabled) diff.pipe(process.stdout)

  lvlDb.get('!last_block!', function (err, lastBlock) {
    if (err && !err.notFound) throw err

    state.processed = lastBlock ? Number(lastBlock) : 0
    state.startBlock = state.currentBlock = lastBlock ? state.processed + 1 : 0
    debug('last block read', state)
    trackSyncing()

    feed.open(function (err) {
      if (err) throw err

      debug('cache is open')

      feed.once('download', function () {
        state.feedLength = feed.blocks
        state.remaining = feed.blocksRemaining() + 1 // +1 because we already downloaded one
        printProgress()

        processChanges(state.startBlock)
      })
    })
  })

  function processChanges (start) {
    debug('processing changes from block %d', start)

    pump(
      feed.createReadStream({start: start}),
      transform(10, processChange),
      through.obj(recordLastBlock),
      onEnd
    )

    function processChange (data, cb) {
      var block = state.currentBlock++
      var change = JSON.parse(data)
      var doc = change.doc
      clean(doc)

      var next = afterAll(function (err) {
        state.bps = downloadSpeed(data.length)
        cb(err, {block: block})
      })

      if (!doc.versions || doc.versions.length === 0) {
        debug('skipping %s - no versions detected', change.id)
        return
      }

      Object.keys(doc.versions).forEach(function (version) {
        var pkg = doc.versions[version]
        debug('storing %s@%s (%d dependencies)...', pkg.name, pkg.version, pkg.dependencies ? Object.keys(pkg.dependencies).length : 0)
        depDb.store(pkg, next())
      })
    }

    function recordLastBlock (data, enc, cb) {
      lvlDb.put('!last_block!', data.block, function (err) {
        state.processed = data.block
        state.pps = processingSpeed(1)
        printProgress()
        cb(err)
      })
    }

    function onEnd (err) {
      if (err) throw err
      printProgress()
      process.exit()
    }
  }

  function trackSyncing () {
    feed.on('download', function (block) {
      state.downloaded++
      if (feed.blocks !== state.feedLength) {
        var newBlocks = feed.blocks - state.feedLength
        state.newBlocks = newBlocks
        state.remaining += newBlocks
        state.feedLength = feed.blocks
        debug('feed.blocks changed', state)
      }
      printProgress()
    })

    setInterval(function () {
      state.bps = downloadSpeed(0)
      state.pps = processingSpeed(0)
      printProgress()
    }, 1000).unref()
  }

  function printProgress () {
    var processedCounter = state.processed - state.startBlock + 1
    var totalToProcess = state.feedLength - state.startBlock

    var sessionBar = progress({total: state.remaining})
    var processedBar = progress({total: totalToProcess})

    diff.write(
      util.format('downloading [%s] (%d/%d) %s/s\n', sessionBar(state.downloaded), state.downloaded, state.remaining, prettierBytes(state.bps)) +
      util.format('processing  [%s] (%d/%d) %s/sec', processedBar(processedCounter), processedCounter, totalToProcess, state.pps.toFixed(1))
    )
  }
}

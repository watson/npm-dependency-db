'use strict'

var util = require('util')
var progress = require('progress-string')
var diff = require('ansi-diff-stream')()
var speedometer = require('speedometer')
var prettierBytes = require('prettier-bytes')
var Updater = require('../updater')
var debug = require('debug')(require('../package').name)

module.exports = function (db, opts) {
  var downloadSpeed = speedometer()
  var processingSpeed = speedometer()
  var updater = new Updater(db, opts)

  updater.downloaded = 0
  updater.bps = 0
  updater.pps = 0
  updater
    .on('init', function () {
      trackSyncing()
    })
    .on('processed', function () {
      updater.pps = processingSpeed(1)
    })
    .on('end', function () {
      printProgress()
      process.exit(updater.live ? 1 : 0)
    })
    .on('error', function (err) {
      throw err
    })

  if (!debug.enabled) diff.pipe(process.stdout)

  function trackSyncing () {
    updater.feed.on('download', function (block, data) {
      updater.bps = downloadSpeed(data.length)
      updater.downloaded++
      if (updater.feed.blocks !== updater.feedLength) {
        var newBlocks = updater.feed.blocks - updater.feedLength
        updater.newBlocks = newBlocks
        updater.remaining += newBlocks
        updater.feedLength = updater.feed.blocks
        debug('feed.blocks changed')
      }
    })

    setInterval(function () {
      updater.bps = downloadSpeed(0)
      updater.pps = processingSpeed(0)
    }, 1000).unref()

    setInterval(printProgress, 250).unref()
  }

  function printProgress () {
    var processedCounter = updater.processed - updater.startBlock + 1

    if (updater.live) {
      diff.write(
        util.format('downloaded %d [%s/s]\n', updater.downloaded, prettierBytes(updater.bps)) +
        util.format('processed  %d [%s/sec]', processedCounter, updater.pps.toFixed(1))
      )
    } else {
      var totalToProcess = updater.feedLength - updater.startBlock
      var sessionBar = progress({total: updater.remaining})
      var processedBar = progress({total: totalToProcess})

      diff.write(
        util.format('downloading [%s] (%d/%d) %s/s\n', sessionBar(updater.downloaded), updater.downloaded, updater.remaining, prettierBytes(updater.bps)) +
        util.format('processing  [%s] (%d/%d) %s/sec', processedBar(processedCounter), processedCounter, totalToProcess, updater.pps.toFixed(1))
      )
    }
  }
}

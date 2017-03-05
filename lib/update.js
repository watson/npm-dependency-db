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
  var lastFeedLength = 0
  var downloaded = 0
  var remaining = 0
  var bps = 0
  var pps = 0

  updater
    .on('init', trackSyncing)
    .on('running', function () {
      lastFeedLength = updater.feed.length
      remaining = updater.blocksRemaining()
    })
    .on('processed', function () {
      pps = processingSpeed(1)
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
    updater.feed.on('download', function (index, data) {
      bps = downloadSpeed(data.length)
      downloaded++
      if (updater.feed.length > lastFeedLength) {
        remaining += updater.feed.length - lastFeedLength
        lastFeedLength = updater.feed.length
        debug('feed.length changed')
      }
    })

    setInterval(function () {
      bps = downloadSpeed(0)
      pps = processingSpeed(0)
    }, 1000).unref()

    setInterval(printProgress, 250).unref()
  }

  function printProgress () {
    var processedCounter = updater.processed - updater.startBlock + 1

    if (updater.live) {
      diff.write(
        util.format('downloaded %d [%s/s]\n', downloaded, prettierBytes(bps)) +
        util.format('processed  %d [%s/sec]', processedCounter, pps.toFixed(1))
      )
    } else {
      var totalToProcess = updater.feed.length - updater.startBlock
      var sessionBar = progress({total: remaining})
      var processedBar = progress({total: totalToProcess})

      diff.write(
        util.format('downloading [%s] (%d/%d) %s/s\n', sessionBar(downloaded), downloaded, remaining, prettierBytes(bps)) +
        util.format('processing  [%s] (%d/%d) %s/sec', processedBar(processedCounter), processedCounter, totalToProcess, pps.toFixed(1))
      )
    }
  }
}

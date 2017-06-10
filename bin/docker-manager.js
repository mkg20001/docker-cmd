#!/usr/bin/env node

'use strict'

const dockerCM = require('../lib/docker-manager') // inspired by http://yahooeng.tumblr.com/post/75054690857/code-coverage-for-executable-node-js-scripts
dockerCM({
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
  argv: process.argv
}, function (exitStatus) {
  process.exit(exitStatus)
})

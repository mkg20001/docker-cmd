"use strict"

const child_process = require('child_process')

const debug = (process.env.NODE_DEBUG || "").indexOf("libdocker") != -1

/**
 * Captures a stream's output
 * @param {stream} s
 * @return {function}
 */

function captureStream(s) {
  let d = []
  s.on("data", data => d.push(data))
  return (t) => t ? Buffer.concat(d).toString().replace(/\n/g, "").trim() : Buffer.concat(d).toString()
}

/**
 * This is a DockerCmd representing "docker" command line
 * @constructor
 */
function DockerCmd() {}

/**
 * @callback DockerCmd~callback
 * @param {number} dockerProcessExitCode - the docker process exit code (0 if all was OK)
 */

/**
 * Execute the given <code>commandName</code> with the given <code>dockerOptions</code> and <code>commandOptions</code>.
 * @param {string} commandName
 * @param {Options} commandOptions
 * @param {Object} dockerOptions
 * @param {DockerCmd~callback} callback
 */
DockerCmd.prototype.executeCommand = function (commandName, commandOptions, dockerOptions, cb) {
  if (!cb && typeof dockerOptions == "function") {
    cb = dockerOptions
    dockerOptions = {}
  }
  // put all options in an array to give to "spawn" later
  var cmdOptions = ['docker']

  // first the docker options to pass before the docker command
  appendOptions(cmdOptions, dockerOptions)
  // then the docker command
  cmdOptions.push(commandName)

  switch (commandName) {
  case "rmi":
  case "run":
    if (commandOptions.image) {
      if (!Array.isArray(commandOptions._)) commandOptions._ = []
      commandOptions._.unshift(commandOptions.image)
      delete commandOptions.image
    }
    break;
  }

  let captureOutput = false

  if (commandOptions.captureOutput) {
    captureOutput = commandOptions.captureOutput
    delete commandOptions.captureOutput
  }

  // and finally the command options with potentially final args (using the '_' field)
  appendOptions(cmdOptions, commandOptions)

  if (debug) console.log("LIBDOCKER", {
    commandName,
    commandOptions,
    dockerOptions,
    cmdOptions,
    captureOutput
  })

  if (captureOutput) {
    const dockerProcess = child_process.spawn('/usr/bin/env', cmdOptions, {
      stdio: ["ignore", "pipe", "pipe"] //in, out, err
    })

    dockerProcess.stderr = captureStream(dockerProcess.stderr)
    dockerProcess.stdout = captureStream(dockerProcess.stdout)

    dockerProcess.on("close", (e, s) => {
      if (e || s) return cb(new Error(dockerProcess.stderr(true) ? dockerProcess.stderr(true) + " (result=" + (e || s) + ")" : "Docker command failed with code/signal " + (e || s)), dockerProcess.stdout())
      return cb(null, dockerProcess.stdout())
    })

  } else {
    child_process.spawn('/usr/bin/env', cmdOptions, {
      stdio: 'inherit'
    }).on('close', (code, sig) => {
      if (code || sig) return cb(new Error("Docker command failed with code/signal " + (code || sig)))
      else return cb()
    })
  }
}

/**
 * @param {string} commandName
 * @return {function(this:DockerCmd, Options, Object, DockerCmd~callback)}
 * @private
 */
DockerCmd.prototype._createDefaultCommand = function (commandName) {
  var self = this
  /**
   * @param {Options} commandOptions
   * @param {Object} dockerOptions
   * @param {DockerCmd~callback} callback
   */
  return function (commandOptions, dockerOptions, callback) {
    self.executeCommand(commandName, commandOptions, dockerOptions, callback)
  }
};

/// Declare all the docker commands
[
  'attach',
  'build',
  'commit',
  'cp',
  'diff',
  'exec',
  'events',
  'export',
  'history',
  'images',
  'import',
  'info',
  'inspect',
  'kill',
  'load',
  'login',
  'logout',
  'logs',
  'port',
  'pause',
  'ps',
  'pull',
  'push',
  'restart',
  'rm',
  'run',
  'save',
  'search',
  'start',
  'stop',
  'tag',
  'top',
  'unpause',
  'version',
  'wait'
].forEach(function (commandName) {
  DockerCmd.prototype[commandName] = DockerCmd.prototype._createDefaultCommand(commandName)
})

/**
 * Append each option from the given <code>fromOptions</code> to the given
 * <code>options</code> array, flattening them to pass them later as parameters to a
 * sub call process.
 * @param {string[]} options
 * @param {Options} fromOptions
 */
function appendOptions(options, fromOptions) {
  function pushOption(optionName, optionValue) {
    var valueDefined = optionValue !== null && optionValue !== undefined
    if (optionName.length === 1) {
      // simple letter option
      options.push('-' + optionName)
      if (valueDefined) {
        options.push(optionValue)
      }
    } else {
      // full option name
      options.push('--' + optionName + (valueDefined ? '=' + optionValue : ''))
    }
  }
  for (var optionName in fromOptions) {
    if (fromOptions.hasOwnProperty(optionName) && optionName !== '_') {
      var optionValue = fromOptions[optionName]
      if (Array.isArray(optionValue)) {
        // we have multiple values for the same option, let's iterate on each
        optionValue.forEach(iOptionValue => {
          pushOption(optionName, iOptionValue)
        })
      } else {
        pushOption(optionName, optionValue)
      }
    }
  }
  // now append the "_" which are not "options" but args
  if (fromOptions && fromOptions._) {
    [].concat(fromOptions._).forEach(function (arg) {
      options.push(arg)
    })
  }
}

module.exports = DockerCmd

module.exports = PSCommandService;

var Promise = require('promise');
var Mustache = require('mustache');

/**
* PSCommandService
*
* @param statefulProcessCommandProxy all commands will be executed over this
*
* @param commandRegistry registry/hash of Powershell commands
*        @see o365CommandRegistry.js for examples
*
* @param logFunction optional function that should have the signature
*                            (severity,origin,message), where log messages will
*                            be sent to. If null, logs will just go to console
*
*/
function PSCommandService(statefulProcessCommandProxy,commandRegistry,logFunction) {
    this._statefulProcessCommandProxy = statefulProcessCommandProxy;
    this._commandRegistry = commandRegistry;
    this._logFunction = logFunction;
}

// log function for no origin
PSCommandService.prototype._log = function(severity,msg) {
    this._log2(severity,this.__proto__.constructor.name,msg);
}


// Log function w/ origin
PSCommandService.prototype._log2 = function(severity,origin,msg) {
    if (this._logFunction) {
        this._logFunction(severity,origin,msg);

    } else {
        console.log(severity.toUpperCase() + " " + origin + " " + msg);
    }
}


/**
* Returns an array of all available command objects
*
* { commandName:name, command:commandString, arguments:{}, return: {} }
*
*/
PSCommandService.prototype.getAvailableCommands = function() {
    var commands = [];
    for (var cmd in this._commandRegistry) {
        commands.push({
          'commandName' : cmd,
          'command' : this._commandRegistry[cmd].command,
          'arguments' : this._commandRegistry[cmd].arguments,
          'return' : this._commandRegistry[cmd].return
        });

    }

    return commands;
}

/**
* getStatus()
*
* Return the status of all managed processes, an array
* of structured ProcessProxy status objects
*/
PSCommandService.prototype.getStatus = function() {
    var status = this._statefulProcessCommandProxy.getStatus();
    return status;
}

// get a CommandConfig by commandName, throws error otherwise
PSCommandService.prototype._getCommandConfig = function(commandName) {
    var commandConfig = this._commandRegistry[commandName];
    if (!commandConfig) {
        var msg = ("No command registered by name: " + commandName);
        this._log('error',msg)
        throw new Error(msg);
    }
    return commandConfig;
}

/**
* generateCommand()
*
* Generates an actual powershell command as registered in the
* command registry, applying the values from the argument map
* returns a literal command string that can be executed
*
*
* @param commandName
* @param argument2ValueMap
* @return command generated, otherwise Error if command not found
*/
PSCommandService.prototype.generateCommand = function(commandName, argument2ValueMap) {
    var commandConfig = this._getCommandConfig(commandName);
    var generated = this._generateCommand(commandConfig, argument2ValueMap);
    return generated;
}

/**
* execute()
*
* Executes a named powershell command as registered in the
* command registry, applying the values from the argument map
* returns a promise that when fulfilled returns the cmdResult
* object from the command which contains properties
* {commandName: name, command:generatedCommand, stdout:xxxx, stderr:xxxxx}
*
* On reject an Error object
*
* @param array of commands
*/
PSCommandService.prototype.execute = function(commandName, argument2ValueMap) {
  var command = this.generateCommand(commandName, argument2ValueMap);
  var self = this;
  return new Promise(function(fulfill,reject) {
      self._execute(command)
          .then(function(cmdResult) {
              // tack on commandName
              cmdResult['commandName'] = commandName;
              fulfill(cmdResult);
          }).catch(function(error){
              reject(error);
          });
  });
}

/**
* executeAll()
*
* Expects an array of commandNames -> argMaps to execute in order
*   [
*      {commandName: name1, argMap: {param:value, param:value, ...}},
*      {commandName: name2, argMap: {param:value, param:value, ...}},
*   ]
*
* Executes the named powershell commands as registered in the
* command registry, applying the values from the argument maps
* returns a promise that when fulfilled returns an cmdResults array
* where each entry contains
*            [
*              {commandName: name1, command:cmd1, stdout:xxxx, stderr:xxxxx},
*              {commandName: name2, command:cmd2, stdout:xxxx, stderr:xxxxx}
*            ]
*
* On reject an Error object
*
* @param array of {commandName -> arglist}
*/
PSCommandService.prototype.executeAll = function(cmdName2ArgValuesList) {

  var commandsToExec = [];

  for (var i=0; i<cmdName2ArgValuesList.length; i++) {
      var cmdRequest = cmdName2ArgValuesList[i];
      var command = this.generateCommand(cmdRequest.commandName, cmdRequest.argMap);
      commandsToExec.push(command);
  }

  var self = this;

  // execute and get back ordered results
  return new Promise(function(fulfill,reject) {

      self._executeCommands(commandsToExec)
            .then(function(cmdResults) {

                // iterate over them (the order will match the order of the cmdName2ArgValuesList)
                // modify each cmdResult adding the commandName attribute
                for (var i=0; i<cmdResults.length; i++) {
                    var cmdResult = cmdResults[i];
                    var cmdRequest = cmdName2ArgValuesList[i];
                    cmdResult['commandName'] = cmdRequest.commandName;
                }

                fulfill(cmdResults);

            }).catch(function(error) {
                self._log('error','Unexepected error in executeAll(): ' + error + ' ' + error.stack);
                reject(error);
            });
    });


}



/**
* _execute()
*
* Executes one powershell command generated by _generateCommand(),
* returns a promise when fulfilled returns the cmdResult object from the command
* which contains 3 properties (command, stdout, stderr)
*
* On reject an Error Object
*
* @param array of commands
*/
PSCommandService.prototype._execute = function(command) {
  var self = this;
  return new Promise(function(fulfill,reject) {
    self._executeCommands([command])
        .then(function(cmdResults) {
            fulfill(cmdResults[0]); // only one will return
        }).catch(function(error) {
            self._log('error','Unexepected error in _execute(): ' + error + ' ' + error.stack);
            reject(error);
        });
  });
}


/**
* _executeCommands()
*
* Executes one or more powershell commands generated by _generateCommand(),
* returns a promise when fulfilled returns an hash of results in the form:

* { <command> : {command: <command>, stdout: value, stderr: value }}
*
* On reject an Error object
*
* @param array of commands
*/
PSCommandService.prototype._executeCommands = function(commands) {
    var self = this;

    var logBuffer = "";
    for (var i=0; i<commands.length; i++) {
        logBuffer += commands[i] + "\n";
    }

    self._log('info','Executing:\n'+logBuffer+'\n');

    return new Promise(function(fulfill,reject) {
        self._statefulProcessCommandProxy.executeCommands(commands)
            .then(function(cmdResults) {
                fulfill(cmdResults);
            }).catch(function(error) {
                self._log('error','Unexepected error from _statefulProcessCommandProxy.executeCommands(): ' + error + ' ' + error.stack);
                reject(error);
            });
    });
}

/**
* _generateCommand()
*
* @param commandConfig a command config object that the argumentMap will be applied to
* @param argument2ValueMap map of argument names -> values (valid for the passed commandConfig)
*
* @return a formatted powershell command string suitable for execution
*
* @throws Error if any exception occurs
*
* !!!! TODO: review  security protection for "injection" (i.e command termination, newlines etc)
*/
PSCommandService.prototype._generateCommand = function(commandConfig, argument2ValueMap) {

    try {
        var argumentsConfig = commandConfig.arguments;

        var argumentsString = "";

        for (var argumentName in argumentsConfig) {

            if(argumentsConfig.hasOwnProperty(argumentName)) {

                var argument = argumentsConfig[argumentName];

                // is argument valued
                if ((argument.hasOwnProperty('valued') ? argument.valued : true)) {

                    var isQuoted = (argument.hasOwnProperty('quoted') ? argument.quoted : true);
                    var passedArgValues = argument2ValueMap[argumentName];

                    if (!(passedArgValues instanceof Array)) {

                        if (typeof passedArgValues === 'undefined') {

                            if (argument.hasOwnProperty('default')) {
                                passedArgValues = [argument.default];
                            } else {
                                passedArgValues = [];
                            }

                        } else {
                            passedArgValues = [passedArgValues];
                        }
                    }

                    var argumentValues = "";
                    for (var i=0; i<passedArgValues.length; i++) {

                        var passedArgValue = passedArgValues[i];

                        var valueToSet;

                        if (passedArgValue && passedArgValue != 'undefined') {
                            valueToSet = passedArgValue;

                        } else if (argument.hasOwnProperty('default')) {
                            valueToSet = argument.default;
                        }

                        // append the value
                        if (valueToSet && valueToSet.trim().length > 0) {

                            // sanitize
                            valueToSet = this._sanitize(valueToSet,isQuoted);

                            // append w/ quotes (SINGLE QUOTES, not double to avoid expansion)
                            argumentValues += (this._finalizeParameterValue(valueToSet,isQuoted) + ",");
                        }
                    }

                    // were values appended?
                    if (argumentValues.length > 0) {

                        // append to arg string
                        argumentsString += (("-"+argumentName+" ") + argumentValues);

                        if (argumentsString.lastIndexOf(',') == (argumentsString.length -1)) {
                            argumentsString = argumentsString.substring(0,argumentsString.length-1);
                        }
                        argumentsString += " ";
                    }

                    // argument is NOT valued, just append the name
                } else {
                    argumentsString += ("-"+argumentName+" ");
                }

            }

        }

        return Mustache.render(commandConfig.command,{'arguments':argumentsString});

    } catch(exception) {
        var msg = ("Unexpected error in _generateCommand(): " + exception + ' ' + exception.stack);
        this._log('error',msg)
        throw new Error(msg);
    }
}

PSCommandService.prototype._finalizeParameterValue = function(valueToSet, applyQuotes) {
    valueToSet = ((applyQuotes?"'":'')+valueToSet+(applyQuotes?"'":''));

    return valueToSet;
}

PSCommandService.prototype._sanitize = function(toSanitize,isQuoted) {
    toSanitize.replace(/(\n)/g, "\\$1"); // escape newlines

    // escape stuff that could screw up variables
    toSanitize = toSanitize.replace(/([`#])/g, "`$1");

    // if quoted, escape all quotes
    if (isQuoted) {
        toSanitize = toSanitize.replace(/(['])/g, "'$1");

    // if not quoted, stop $ and |
    } else {
        toSanitize = toSanitize.replace(/([\$\|])/g, "`$1");
    }

    return toSanitize;
}

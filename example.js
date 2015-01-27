var Promise = require('promise');
var StatefulProcessCommandProxy = require("stateful-process-command-proxy");
var PSCommandService = require('./psCommandService');
var o365Utils = require('./o365Utils');




var statefulProcessCommandProxy = new StatefulProcessCommandProxy({
  name: "StatefulProcessCommandProxy",
  max: 1,
  min: 1,
  idleTimeoutMillis:120000,
  log: function(severity,origin,msg) {
    console.log(severity.toUpperCase() + " " +origin+" "+ msg);
  },

  processCommand: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
  processArgs:    ['-Command','-'],


  processRetainMaxCmdHistory : 20,
  processInvalidateOnRegex : {
    'any':[],
    'stdout':[],
    'stderr':['.*error.*']
  },
  processCwd : null,
  processEnvMap : null,
  processUid : null,
  processGid : null,

  initCommands: o365Utils.getO365PSInitCommands(
    'C:\\pathto\\decryptUtil.ps1',
    'C:\\pathto\\encrypted.credentials',
    'C:\\pathto\\secret.key',
    10000,30000,60000),


  validateFunction: function(processProxy) {
    var isValid = processProxy.isValid();
    if(!isValid) {
      console.log("ProcessProxy.isValid() returns FALSE!");
    }
    return isValid;
  },


  preDestroyCommands:
              [
              'Get-PSSession | Remove-PSSession',
              'Remove-PSSession -Session $session'
              ],


  processCmdBlacklistRegex: ['.*\sdel\s.*'],

  autoInvalidationConfig: {
      'checkIntervalMS': 1000, // check every 30s
      'commands': [
            // no remote pssession established? invalid!
            { 'command': 'Get-PSSession',
              'regexes': {
                  'stdout' : [ {'regex':'.*Opened.*', 'invalidOn':'noMatch'}]
              }
            }
        ]
    }

});


/**
* Fetch a group!
*/
var psCommandService = new PSCommandService(statefulProcessCommandProxy, o365Utils.o365CommandRegistry);
psCommandService.execute('getDistributionGroup',{'Identity':"someGroupName"})
          .then(function(groupJson) {
              console.log(groupJson);
          }).catch(function(error) {
              console.log(error);
          });

setTimeout(function(){statefulProcessCommandProxy.shutdown()},80000);

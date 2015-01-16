var Promise = require('promise');
var StatefulProcessCommandProxy = require("stateful-process-command-proxy");
var PSCommandService = require('./psCommandService');
var o365Utils = require('./o365Utils');




var statefulProcessCommandProxy = new StatefulProcessCommandProxy({
  name: "StatefulProcessCommandProxy",
  max: 1,
  min: 1,
  idleTimeoutMillis: 10000,
  log: function(severity,origin,msg) {
    console.log(severity.toUpperCase() + " " +origin+" "+ msg);
  },

  processCommand: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
  processArgs:    ['-Command','-'],


  processRetainMaxCmdHistory : 20,
  processInvalidateOnRegex : {
    'any':[],
    'stdout':[],
    'stderr':['.*'] // anything comes in on stderr, invalidate it
  },
  processCwd : null,
  processEnvMap : null,
  processUid : null,
  processGid : null,

  initCommands: o365Utils.getO365PSInitCommands(
    'C:\\full\\path\\to\\powershell-credential-encryption-tools\\decryptUtil.ps1',
    'C:\\full\\path\\to\\encrypted.credentials',
    'C:\\full\\path\\to\\secret.key',
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
              ]

});


/**
* Fetch a group!
*/
var psCommandService = new PSCommandService(statefulProcessCommandProxy, o365Utils.o365CommandRegistry);
var promise = psCommandService.executeForStdout('getDistributionGroup',{'Identity':"someGroupName"})
          .then(function(groupJson) {
            console.log(groupJson);
          }).catch(function(error) {
            console.log(error);
          });

setTimeout(function(){statefulProcessCommandProxy.shutdown()},30000);

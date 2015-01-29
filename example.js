var Promise = require('promise');
var StatefulProcessCommandProxy = require("stateful-process-command-proxy");
var PSCommandService = require('./psCommandService');
var o365Utils = require('./o365Utils');




var statefulProcessCommandProxy = new StatefulProcessCommandProxy({
  name: "StatefulProcessCommandProxy",
  max: 1,
  min: 1,
  idleTimeoutMS:120000,
  log: function(severity,origin,msg) {
    console.log(severity.toUpperCase() + " " +origin+" "+ msg);
  },

  processCommand: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
  processArgs:    ['-Command','-'],


  processRetainMaxCmdHistory : 20,
  processInvalidateOnRegex : {
    'any':[],
    'stdout':[],
    'stderr':[{'regex':'.*error.*'}]
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


  preDestroyCommands: o365Utils.getO365PSDestroyCommands(),

  processCmdWhitelistRegex: o365Utils.getO365WhitelistedCommands(),

  processCmdBlacklistRegex: o365Utils.getO365BlacklistedCommands(),

  autoInvalidationConfig: o365Utils.getO365AutoInvalidationConfig(30000)

});

var myLogFunction = function(severity,origin,message) {
    console.log(severity.toUpperCase() + ' ' + origin + ' ' + message);
}


/**
* Fetch a group!
*/
var psCommandService = new PSCommandService(statefulProcessCommandProxy,
                                            o365Utils.o365CommandRegistry,
                                            myLogFunction);

psCommandService.execute('getDistributionGroup',{'Identity':"someGroupName"})
          .then(function(groupJson) {
              console.log(groupJson);
          }).catch(function(error) {
              console.log(error);
          });

setTimeout(function(){statefulProcessCommandProxy.shutdown()},80000);

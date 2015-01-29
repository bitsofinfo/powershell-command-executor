var assert = require('assert');
var Promise = require('promise');
var fs = require('fs');
var o365Utils = require('../o365Utils');
var PSCommandService = require('../psCommandService');

/**
* IMPORTANT!
* To run this test, you need to configure
* the following 4 variables!
*
* The credentials you are using to access o365 should
* be for a user that is setup as follows @:
* https://bitsofinfo.wordpress.com/2015/01/06/configuring-powershell-for-azure-ad-and-o365-exchange-management/
*
* @see https://github.com/bitsofinfo/powershell-credential-encryption-tools
*/
var PATH_TO_DECRYPT_UTIL_SCRIPT = 'C:\\pathto\\decryptUtil.ps1';
var PATH_TO_ENCRYPTED_CREDENTIALS = 'C:\\pathto\\encrypted.credentials';
var PATH_TO_SECRET_KEY = 'C:\\pathto\\secret.key';
var O365_TENANT_DOMAIN_NAME = "somedomain.com";

describe('test PSCommandService w/ o365CommandRegistry', function() {

  it('Should test all group and mail contact commands then cleanup', function(done) {

    this.timeout(120000);

    var Promise = require('promise');
    var StatefulProcessCommandProxy = require("stateful-process-command-proxy");

    // configure our proxy/pool of processes
    var statefulProcessCommandProxy = new StatefulProcessCommandProxy(
      {
        name: "o365 RemotePSSession powershell pool",
        max: 1,
        min: 1,
        idleTimeoutMS: 30000,

        logFunction: function(severity,origin,msg) {
          if (origin != 'Pool') {
            console.log(severity.toUpperCase() + " " +origin+" "+ msg);
          }
        },

        processCommand: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        processArgs:    ['-Command','-'],


        processRetainMaxCmdHistory : 30,
        processInvalidateOnRegex : {
          'any':[{'regex':'.*nomatch.*','flags':'i'}],
          'stdout':[{'regex':'.*nomatch.*'}],
          'stderr':[{'regex':'.*nomatch.*'}]
        },
        processCwd : null,
        processEnvMap : null,
        processUid : null,
        processGid : null,

        initCommands: o365Utils.getO365PSInitCommands(
                              PATH_TO_DECRYPT_UTIL_SCRIPT,
                              PATH_TO_ENCRYPTED_CREDENTIALS,
                              PATH_TO_SECRET_KEY,
                              10000,30000,60000),

        validateFunction: function(processProxy) {
            return processProxy.isValid();
        },

        preDestroyCommands: o365Utils.getO365PSDestroyCommands(),

        processCmdBlacklistRegex: o365Utils.getO365BlacklistedCommands(),

        processCmdWhitelistRegex: o365Utils.getO365WhitelistedCommands(),

        autoInvalidationConfig: o365Utils.getO365AutoInvalidationConfig(30000)

      });

      var myLogFunction = function(severity,origin,message) {
          console.log(severity.toUpperCase() + ' ' + origin + ' ' + message);
      }

      // create our PSCommandService
      var psCommandService = new PSCommandService(statefulProcessCommandProxy,
                                                  o365Utils.o365CommandRegistry,
                                                  myLogFunction);

      // random seed for generated data
      var random = "unitTest"+Math.abs(Math.floor(Math.random() * (1000 - 99999 + 1) + 1000));

      var testUserName = "auser-"+random;
      var testUserEmail = testUserName+"@"+O365_TENANT_DOMAIN_NAME;

      var testUser2Name = "auser2-"+random;
      var testUser2Email = testUser2Name+"@"+O365_TENANT_DOMAIN_NAME;

      var testMailContactName = "amailContact-"+random;
      var testMailContactEmail = testMailContactName+"@"+O365_TENANT_DOMAIN_NAME;

      var testGroupName = "agroup-"+random;
      var testGroupEmail = testGroupName+"@"+O365_TENANT_DOMAIN_NAME;

      // total hack, needed due to deplays on ms side
      var sleep = function(milliseconds) {
        var start = new Date().getTime();
        var c = 0;
        for (var i = 0; i < 1e7; i++) {
          if ((new Date().getTime() - start) > milliseconds){
            break;

          } else {
            console.log("SLEEP....");
          }
        }
      }


      var evalCmdResult = function(cmdResult, doWithCmdResult) {
          if (cmdResult.stderr && cmdResult.stderr.length > 0) {
            console.log("Stderr received: " + cmdResult.stderr);
            assert(false);

          // otherwise assume ok
          } else {
              return doWithCmdResult(cmdResult);
          }
      }

      var evalCmdResults = function(cmdResults, doWithCmdResults) {

        var hasErrors = false;
        for (var i=0; i<cmdResults.length; i++) {
            var cmdResult = cmdResults[i];
            if (cmdResult.stderr && cmdResult.stderr.length > 0) {
              console.log("Stderr received: " + cmdResult.stderr);
              hasErrors = true;
            }
        }

        if (hasErrors) {
          assert(false);

          // otherwise assume ok
        } else {
          return doWithCmdResults(cmdResults);
        }
      }

      var cleanupAndShutdown = function(done,error) {
          psCommandService.execute('removeMsolUser', {'UserPrincipalName':testUserEmail });
          psCommandService.execute('removeMsolUser', {'UserPrincipalName':testUser2Email });
          psCommandService.execute('removeDistributionGroup', {'Identity':testGroupEmail });
          psCommandService.execute('removeMailContact', {'Identity':testMailContactEmail });

          // shut it all down
          setTimeout(function() {
              statefulProcessCommandProxy.shutdown();
          },5000);

          setTimeout(function() {
             if (error) {
                done(error);
             } else {
                done();
             }

          },10000);

          // throw, it will stop the rest of the execution.
          if (error) {
              throw error;
          }
      }


      // #1 create test users that we will use
      var promise = psCommandService.executeAll(
                          [
                              {'commandName':'newMsolUser',
                                'argMap': {
                                   'DisplayName':testUserName,
                                   'UserPrincipalName':testUserEmail
                                 }
                              },
                              {'commandName':'newMsolUser',
                                'argMap': {
                                  'DisplayName':testUser2Name,
                                  'UserPrincipalName':testUser2Email
                                }
                            },
                          ])

        // handle newMsolUsers results... if ok getMsolUsers
        .then(function(cmdResults) {

          return evalCmdResults(cmdResults, function(cmdResults) {
              try {
                  assert.equal(2,cmdResults.length);
              } catch(e) {
                  cleanupAndShutdown(done,e);
              }
              console.log("msolUsers added OK: " + testUserEmail + " & " + testUser2Email);
              return psCommandService.executeAll(
                    [
                    {'commandName':'getMsolUser', 'argMap': {'UserPrincipalName':testUserEmail }},
                    {'commandName':'getMsolUser', 'argMap': {'UserPrincipalName':testUser2Email }}
                    ]);
          });

        })

        // handle getMsolUsers result... if ok create distributionGroup
        .then(function(cmdResults) {

            return evalCmdResults(cmdResults, function(cmdResults) {
                try {
                    assert.equal(2,cmdResults.length);
                } catch(e) {
                    cleanupAndShutdown(done,e);
                }

                for (var i=0; i<cmdResults.length; i++) {
                  var cmdResult = cmdResults[i];
                  var msolUser = JSON.parse(cmdResult.stdout);

                  try {
                      // check that either of our expected ones are in here...
                      assert((testUserEmail == msolUser.UserPrincipalName) || (testUser2Email == msolUser.UserPrincipalName));
                  } catch(e) {
                      cleanupAndShutdown(done,e);
                  }
                }

                console.log("msolUsers fetched OK");
                sleep(60000);
                return psCommandService.execute('newDistributionGroup',
                      {
                        'Name':               testGroupName,
                        'DisplayName':        testGroupName,
                        'PrimarySmtpAddress': testGroupEmail,
                        'ManagedBy':          testUserEmail,
                        'Members':            testUserEmail
                      });
            });

        })

        // handle createDistributionResult ... if ok get distributionGroup
        .then(function(cmdResult) {

          return evalCmdResult(cmdResult, function(cmdResult) {
            var distributionGroup = JSON.parse(cmdResult.stdout);
            try {
                assert.equal(testGroupEmail,distributionGroup.PrimarySmtpAddress);
            } catch(e) {
                cleanupAndShutdown(done,e);
            }
            console.log("distributionGroup created OK: " + distributionGroup.PrimarySmtpAddress);
            return psCommandService.execute('getDistributionGroup',
                        {
                          'Identity':  testGroupEmail
                        });
          });

        })

        // handle getDistributionGroup ... if ok get addDistributionGroupMember
        // for user 1 and user 2
        .then(function(cmdResult) {

          return evalCmdResult(cmdResult, function(cmdResult) {
            var distributionGroup = JSON.parse(cmdResult.stdout);
            try {
                assert.equal(testGroupEmail,distributionGroup.PrimarySmtpAddress);
            } catch(e) {
                cleanupAndShutdown(done,e);
            }
            console.log("distributionGroup fetched OK: " + distributionGroup.PrimarySmtpAddress);
            return psCommandService.executeAll([
                {'commandName':'addDistributionGroupMember',
                  'argMap': {
                        'Identity':  testGroupEmail,
                        'Member': testUserEmail,
                        'BypassSecurityGroupManagerCheck':null,
                      }
                },
                {'commandName':'addDistributionGroupMember',
                  'argMap': {
                      'Identity':  testGroupEmail,
                      'Member': testUser2Email,
                      'BypassSecurityGroupManagerCheck':null,
                    }
                  }
                ]);
          });

        })


        // handle addDistributionGroupMember ... if ok get getDistributionGroupMember
        .then(function(cmdResults) {

          return evalCmdResult(cmdResults, function(cmdResults) {
            console.log("distributionGroupMembers added OK");
            return psCommandService.execute('getDistributionGroupMember',
                    {
                      'Identity':  testGroupEmail
                    });
          });

        })

        // handle getDistributionGrouMembers (should be 2) ...
        // if ok get removeDistributionGroupMember (user2)
        .then(function(cmdResult) {

          return evalCmdResult(cmdResult, function(cmdResult) {
            var members = JSON.parse(cmdResult.stdout);
            try {
                assert.equal(members.length,2);
            } catch(e) {
                cleanupAndShutdown(done,e);
            }
            console.log("distributionGroup members fetched OK: " + members.length);
            return psCommandService.execute('removeDistributionGroupMember',
                  {
                    'Identity':  testGroupEmail,
                    'Member': testUser2Email
                  });
          });

        })

        // handle removeDistributionGroupMember ...
        // if ok get getDistributionGroupMember
        .then(function(cmdResult) {

          return evalCmdResult(cmdResult, function(cmdResult) {
            console.log("distributionGroupMember (user2) removed OK");
            return psCommandService.execute('getDistributionGroupMember',
                      {
                        'Identity':  testGroupEmail
                      });
                    });

        })

        // handle getDistributionGrouMembers (should now be 1) ...
        //  if ok get newMailContact
        .then(function(cmdResult) {

          return evalCmdResult(cmdResult, function(cmdResult) {
            var members = JSON.parse("["+cmdResult.stdout+"]");
            try {
                assert.equal(members.length,1);
                assert.equal(members[0].WindowsLiveID , testUserEmail);
            } catch(e) {
                cleanupAndShutdown(done,e);
            }
            console.log("getDistributionGroupMember fetched OK: only user1 remains " + members.length);
            return psCommandService.execute('newMailContact',
            {
              'Name':  testMailContactName,
              'ExternalEmailAddress':  testMailContactEmail,
            });
          });

        })


        // handle newMailContact add
        //  if ok get newMailContact
        .then(function(cmdResult) {

          return evalCmdResult(cmdResult, function(cmdResult) {
            console.log("newMailContact added OK: " + testMailContactEmail);
            return psCommandService.execute('getMailContact',
                {
                  'Identity':  testMailContactEmail
                });
          });

        })



        // handle getMailContact
        //  if ok get addDistributionGroupMember
        .then(function(cmdResult) {

          return evalCmdResult(cmdResult, function(cmdResult) {
            var contact = JSON.parse(cmdResult.stdout);
            try {
                assert.equal(testMailContactEmail,contact.PrimarySmtpAddress);
            } catch(e) {
                cleanupAndShutdown(done,e);
            }
            console.log("getMailContact fetched OK: " + testMailContactEmail);
            return psCommandService.execute('addDistributionGroupMember',
                {
                  'Identity':  testGroupEmail,
                  'Member': testMailContactEmail
                });
          });

        })



        // handle addDistributionGroupMember
        //  if ok get addDistributionGroupMember
        .then(function(cmdResult) {

          return evalCmdResult(cmdResult, function(cmdResult) {
            console.log("addDistributionGroupMember mailContact added OK: " + testMailContactEmail);
            return psCommandService.execute('getDistributionGroupMember',
                  {
                    'Identity':  testGroupEmail
                  });
          });

        })


        // handle getDistributionGrouMembers (should now be 2) ...
        //  if ok get removeDistributionGroup
        .then(function(cmdResult) {

          return evalCmdResult(cmdResult, function(cmdResult) {
            var members = JSON.parse(cmdResult.stdout);
            try {
                assert.equal(members.length,2);
            } catch(e) {
                cleanupAndShutdown(done,e);
            }
            console.log("getDistributionGroupMember fetched OK: one mail contact and one user exist " + members.length);
            return psCommandService.execute('removeDistributionGroup',
                  {
                    'Identity':  testGroupEmail
                  });
          });

        })

        // handle removeDistributionGroup then remove msoluser...
        .then(function(cmdResult) {

          return evalCmdResult(cmdResult, function(cmdResult) {
            console.log("distributionGroup removed OK: " + testGroupEmail);
            return psCommandService.execute('removeMsolUser', {'UserPrincipalName':testUserEmail });
          });

        })


        // handle removeMsolUser result... if ok shutdown...
        .then(function(nothing) {
            console.log("msolUser removed OK: " + testUserEmail);

            cleanupAndShutdown(done,null);

        })

        .catch(function(error) {
          console.log(error  + "\n" + error.stack);

          cleanupAndShutdown(done,error);

        });

      });

  });


/**
* getO365PSInitCommands()
*
* Returns an array of Powershell initialization commands suitable
* for setting up shells spawned with StatefulProcessCommandProxy
* to be able to establish a remote PSSession with o365
*
* @see https://github.com/bitsofinfo/powershell-credential-encryption-tools
*
* This function takes the full path to:
* - decryptUtil.ps1 from the project above
* - path the encrypted credentials file generated with decryptUtil.ps1
* - path to the secret key needed to decrypt the credentials
*
* In addition there are parameter to define the PSSessionOption timeouts
*
* Note this is just an example (which works) however you may want to
* replace this with your own set of init command tailored to your specific
* use-case
*
* @see the getO365PSDestroyCommands() below for the corresponding cleanup
* commands for these init commands
*/
module.exports.getO365PSInitCommands = function(pathToDecryptUtilScript,
                                                pathToCredsFile,
                                                pathToKeyFile,
                                                openTimeout,
                                                operationTimeout,
                                                idleTimeout) {
  return [
        // #0 Encoding UTF8
        'chcp 65001',
        '$OutputEncoding = [System.Text.Encoding]::GetEncoding(65001)',

        // #1 import some basics
        'Import-Module MSOnline',

        // #2 source the decrypt utils script
        // https://github.com/bitsofinfo/powershell-credential-encryption-tools/blob/master/decryptUtil.ps1
        ('. ' + pathToDecryptUtilScript),

        // #3 invoke decrypt2PSCredential to get the PSCredential object
        // this function is provided by the sourced file above
        ('$PSCredential = decrypt2PSCredential ' + pathToCredsFile + ' ' + pathToKeyFile),

        // #4+ establish the session to o365
        ('$sessionOpt = New-PSSessionOption -OpenTimeout '+openTimeout+' -OperationTimeout '+operationTimeout+' -IdleTimeout ' + idleTimeout),
        '$session = New-PSSession -ConfigurationName Microsoft.Exchange -ConnectionUri https://outlook.office365.com/powershell-liveid/ -Credential $PSCredential -Authentication Basic -AllowRedirection -SessionOption $sessionOpt',

        // #5 import the relevant cmdlets (TODO: make this configurable)
        'Import-PSSession $session -CommandName *DistributionGroup* -AllowClobber',
        'Import-PSSession $session -CommandName *Contact* -AllowClobber',

        // #6 connect to azure as well
        'Connect-MsolService -Credential $PSCredential',

        // #7 cleanup
        'Remove-Variable -Force -ErrorAction SilentlyContinue $PSCredential'
  ]
}

/**
* Destroy commands that correspond to the session
* established w/ the initCommands above
*/
module.exports.getO365PSDestroyCommands = function() {
    return [
          'Get-PSSession | Remove-PSSession',
          'Remove-PSSession -Session $session',
          'Remove-Module MsOnline'
          ]
  }

/**
* Some example blacklisted commands
*/
module.exports.getO365BlacklistedCommands = function() {
  return [
      {'regex':'.*Invoke-Expression.*', 'flags':'i'},
      {'regex':'.*ScriptBlock.*', 'flags':'i'},
      {'regex':'.*Get-Acl.*', 'flags':'i'},
      {'regex':'.*Set-Acl.*', 'flags':'i'},
      {'regex':'.*Get-Content.*', 'flags':'i'},
      {'regex':'.*-History.*', 'flags':'i'},
      {'regex':'.*Out-File.*', 'flags':'i'}
  ]
}

/**
* Configuration auto invalidation, checking PSSession availability
* @param checkIntervalMS
*/
module.exports.getO365AutoInvalidationConfig = function(checkIntervalMS) {
      return {
              'checkIntervalMS': checkIntervalMS,
              'commands': [
              // no remote pssession established? invalid!
              { 'command': 'Get-PSSession',
                'regexes': {
                  'stdout' : [ {'regex':'.*Opened.*', 'flags':'i', 'invalidOn':'noMatch'}]
                }
              }]
          };
  }


/**
* Defines a registry of Powershell commands
* that can be injected into the PSCommandService
* instance.
*
* Note these are just some example configurations specifically for a few
* o365 functions and limited arguments for each, (they work) however you may want to
* replace this with your own set of init command tailored to your specific
* use-case
*/
var o365CommandRegistry = {

    /*******************************
    *
    * o365 Powershell Command registry
    *
    * argument properties (optional):
    *    - quoted: true|false, default true
    *    - valued: true|false, default true
    *    - default: optional default value (only if valued..)
    *
    * return properties:
    *   type: none, text or json are valid values
    *
    ********************************/

    /*******************************
    * MsolUser
    ********************************/

    'getMsolUser': {
      'command': 'Get-MsolUser {{{arguments}}} | ConvertTo-Json',
      'arguments': {
        'UserPrincipalName': {}
      },
      'return': { type: 'json' }
    },

    'newMsolUser': {
      'command': 'New-MsolUser {{{arguments}}} | ConvertTo-Json',
      'arguments': {
        'DisplayName': {},
        'UserPrincipalName': {}
      },
      'return': { type: 'json' }
    },

    'removeMsolUser': {
      'command': 'Remove-MsolUser -Force {{{arguments}}} ',
      'arguments': {
        'UserPrincipalName': {}
      },
      'return': { type: 'none' }
    },

    /*******************************
    * DistributionGroups
    ********************************/

    'getDistributionGroup': {
        'command': 'Get-DistributionGroup {{{arguments}}} | ConvertTo-Json',
        'arguments': {
            'Identity': {}
        },
        'return': { type: 'json' }
    },

    'newDistributionGroup': {

        'command': 'New-DistributionGroup -Confirm:$False {{{arguments}}} | ConvertTo-Json',

        'arguments': {
            'Name':               {},
            'DisplayName':        {},
            'Alias':              {},
            'PrimarySmtpAddress': {},
            'Type':               {'quoted':false, 'default':'Security'},
            'ManagedBy':          {'quoted':false},
            'Members':            {}, // specifying members on create does not seem to work
            'ModerationEnabled':              { 'default':'$false', 'quoted':false},
            'MemberDepartRestriction':        { 'default':'Closed'},
            'MemberJoinRestriction':          { 'default':'Closed'},
            'SendModerationNotifications':    { 'default':'Never', 'quoted':false},

        },
        'return': { type: 'json' }
    },

    'setDistributionGroup': {

        'command': 'Set-DistributionGroup -Confirm:$False {{{arguments}}}',

        'arguments': {
            'Identity':           {},
            'Name':               {},
            'DisplayName':        {},
            'Alias':              {},
            'PrimarySmtpAddress': {},
            'ManagedBy':          {},
            'Members':            {},
            'MailTip':            {},
            'ModerationEnabled':              { 'default':'$false', 'quoted':false},
            'MemberDepartRestriction':        { 'default':'Closed'},
            'MemberJoinRestriction':          { 'default':'Closed'},
            'SendModerationNotifications':    { 'default':'Never', 'quoted':false},
            'BypassSecurityGroupManagerCheck': {'valued': false}
        },
        'return': { type: 'none' }
    },


    'removeDistributionGroup': {

        'command': 'Remove-DistributionGroup {{{arguments}}} -Confirm:$false',

        'arguments': {
            'Identity':           {},
            // needed if invoking as global admin who is not explicitly a group admin.. stupid... yes.
            'BypassSecurityGroupManagerCheck': {'valued': false}
        },
        'return': { type: 'none' }
    },


    'getDistributionGroupMember': {

        'command': 'Get-DistributionGroupMember {{{arguments}}} | ConvertTo-Json',

        'arguments': {
            'Identity':           {}
        },
        'return': { type: 'json' }
    },


    'addDistributionGroupMember': {

        'command': 'Add-DistributionGroupMember {{{arguments}}}',

        'arguments': {
            'Identity':           {},
            'Member':             {},
            // needed if invoking as global admin who is not explicitly a group admin.. stupid... yes.
            'BypassSecurityGroupManagerCheck': {'valued': false}
        },
        'return': { type: 'none' }
    },

    // members specified w/ this are a full overwrite..
    'updateDistributionGroupMembers': {

        'command': 'Update-DistributionGroupMember -Confirm:$false {{{arguments}}}',

        'arguments': {
            'Identity':           {},
            'Members':            {},
            // needed if invoking as global admin who is not explicitly a group admin.. stupid... yes.
            'BypassSecurityGroupManagerCheck': {'valued': false}
        },
        'return': { type: 'none' }
    },

    'removeDistributionGroupMember': {

        'command': 'Remove-DistributionGroupMember {{{arguments}}} -Confirm:$false',

        'arguments': {
            'Identity':          {},
            'Member':            {},
            // needed if invoking as global admin who is not explicitly a group admin.. stupid... yes.
            'BypassSecurityGroupManagerCheck': {'valued': false}
        },
        'return': { type: 'none' }
    },




    /*******************************
    * MailContacts
    ********************************/

    'getMailContact': {
        'command': 'Get-MailContact {{{arguments}}} | ConvertTo-Json',
        'arguments': {
            'Identity': {}
        },
        'return': { type: 'json' }
    },

    'newMailContact': {

        'command': 'New-MailContact -Confirm:$False {{{arguments}}} | ConvertTo-Json',

        'arguments': {
            'Name':                  {},
            'ExternalEmailAddress':  {}
        },

        'return': { type: 'json' }
    },

    'setMailContact': {

        'command': 'Set-MailContact -Confirm:$False {{{arguments}}}',

        'arguments': {
            'Identity':             {},
            'Name':                 {},
            'DisplayName':          {},
            'ExternalEmailAddress': {}
        },

        'return': { type: 'none' }
    },


    'removeMailContact': {

        'command': 'Remove-MailContact {{{arguments}}} -Confirm:$false',

        'arguments': {
            'Identity':           {}
        },

        'return': { type: 'none' }
    }
};

module.exports.o365CommandRegistry = o365CommandRegistry;

/**
* Some example whitelisted commands
* (only permit) what is in the registry
*/
module.exports.getO365WhitelistedCommands = function() {
    var whitelist = [];
    for (var cmdName in o365CommandRegistry) {
        var config = o365CommandRegistry[cmdName];
        var commandStart = config.command.substring(0,config.command.indexOf(' ')).trim();
        whitelist.push({'regex':'^'+commandStart+'\\s+.*', 'flags':'i'});
    }
    return whitelist;
}

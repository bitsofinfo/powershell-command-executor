
/**
* getO365PSInitCommands()
*
* Returns an array of Powershell initialization commands suitable
* for setting up shells spawned with StatefuleProcesCommandProxy
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
*/
module.exports.getO365PSInitCommands = function(pathToDecryptUtilScript,
                                                pathToCredsFile,
                                                pathToKeyFile,
                                                openTimeout,
                                                operationTimeout,
                                                idleTimeout) {
  return [
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
        'Import-PSSession $session -CommandName *Contact* -AllowClobber'
  ]
}


/**
* Defines a registry of Powershell commands
* that can be injected into the PSCommandService
* instance
*/
module.exports.o365CommandRegistry = {

    /*******************************
    *
    * o365 Powershell Command registry
    *
    * argument properties (optional):
    *    - quoted: true|false, default true
    *    - valued: true|false, default true
    *    - default: optional default value (only if valued..)
    *
    ********************************/


    /*******************************
    * DistributionGroups
    ********************************/

    'getDistributionGroup': {
        'command': 'Get-DistributionGroup {{{arguments}}} | ConvertTo-Json',
        'arguments': {
            'Identity': {}
        }
    },

    'newDistributionGroup': {

        'command': 'New-DistributionGroup -Confirm:$False {{{arguments}}} | ConvertTo-Json',

        'arguments': {
            'Name':               {},
            'DisplayName':        {},
            'Alias':              {},
            'PrimarySmtpAddress': {},
            'ManagedBy':          {},
            'Members':            {},
            'Type':               { 'default':'Security'},
            'ModerationEnabled':              { 'default':'$false', 'quoted':false},
            'MemberDepartRestriction':        { 'default':'Closed'},
            'MemberJoinRestriction':          { 'default':'Closed'},
            'SendModerationNotifications':    { 'default':'Never', 'quoted':false},

        }
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
            'Type':               { 'default':'Security'},
            'ModerationEnabled':              { 'default':'$false', 'quoted':false},
            'MemberDepartRestriction':        { 'default':'Closed'},
            'MemberJoinRestriction':          { 'default':'Closed'},
            'SendModerationNotifications':    { 'default':'Never', 'quoted':false}
        }
    },


    'removeDistributionGroup': {

        'command': 'Remove-DistributionGroup {{{arguments}}} -Confirm:$false',

        'arguments': {
            'Identity':           {}
        }
    },


    'getDistributionGroupMember': {

        'command': 'Get-DistributionGroupMember {{{arguments}}} | ConvertTo-Json',

        'arguments': {
            'Identity':           {}
        }
    },


    'addDistributionGroupMember': {

        'command': 'Add-DistributionGroupMember {{{arguments}}}',

        'arguments': {
            'Identity':           {},
            'Member':             {}
        }
    },

    // members specified w/ this are a full overwrite..
    'updateDistributionGroupMembers': {

        'command': 'Update-DistributionGroupMember -Confirm:$false {{{arguments}}}',

        'arguments': {
            'Identity':           {},
            'Members':            {}
        }
    },

    'removeDistributionGroupMember': {

        'command': 'Remove-DistributionGroupMember {{{arguments}}} -Confirm:$false',

        'arguments': {
            'Identity':          {},
            'Member':            {}
        }
    },




    /*******************************
    * MailContacts
    ********************************/

    'getMailContact': {
        'command': 'Get-MailContact {{{arguments}}} | ConvertTo-Json',
        'arguments': {
            'Identity': {}
        }
    },

    'newMailContact': {

        'command': 'New-MailContact -Confirm:$False {{{arguments}}} | ConvertTo-Json',

        'arguments': {
            'Name':                  {},
            'ExternalEmailAddress':  {}
        }
    },

    'setMailContact': {

        'command': 'Set-MailContact -Confirm:$False {{{arguments}}}',

        'arguments': {
            'Identity':             {},
            'Name':                 {},
            'DisplayName':          {},
            'ExternalEmailAddress': {}
        }
    },


    'removeMailContact': {

        'command': 'Remove-MailContact {{{arguments}}} -Confirm:$false',

        'arguments': {
            'Identity':           {}
        }
    }
};

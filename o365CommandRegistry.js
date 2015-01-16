
module.exports = {
        
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
    
    'getDistributionGroup': {
        'command': 'Get-DistributionGroup {{{arguments}}} | ConvertTo-Json',
        'arguments': {
            'Identity': {}
        }
    },
    
    'createDistributionGroup': {
        
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
    
    'updateDistributionGroup': {
        
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
    
    
    'deleteDistributionGroup': {
        
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
    }

};

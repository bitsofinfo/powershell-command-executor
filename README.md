# powershell-command-executor

Node.js module that provides a registry and gateway for execution of pre-defined powershell commands through long-lived established remote PSSessions.

[![NPM](https://nodei.co/npm/powershell-command-executor.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/powershell-command-executor/)

* [Overview](#overview)
* [Concepts](#concepts)
* [Usage](#usage)
* [History](#history)
* [Related tools](#related)

### <a name="overview"></a>Overview 

This Node.js module builds on top of [stateful-process-command-proxy](https://github.com/bitsofinfo/stateful-process-command-proxy) to provide a higher level API for a registry of pre-defined commands, specifically for various powershell operations agains Office365; or any powershell command really, you just need to configure them. The module provides a simplified interface to pass arguments to various "named" commands, sanitize the arguments and return the results. This module supports concepts that would permit the construction of a higher level interface to this system, such as via a REST API or user interface... see [powershell-command-executor-ui](https://github.com/bitsofinfo/powershell-command-executor-ui) for a working example of this concept in an useable implementation.

![Alt text](/diagram1.png "Diagram1")

### <a name="concepts"></a>Concepts

#### psCommandExecutor.js

This provides the PSCommandService class which is a wrapper around [StatefulProcessCommandProxy](https://github.com/bitsofinfo/stateful-process-command-proxy) which lets a caller invoke "named" commands passing an map/hash of arguments. PSCommandService will generate the actual command and pass it to the StatefulProcessCommandProxy for execution and return the results. PSCommandService must be created passing an configured instance of [StatefulProcessCommandProxy](https://github.com/bitsofinfo/stateful-process-command-proxy) and a "registry" of commands. You can see an example of what a command registry looks like within ```o365Utils.js```. You don't have to use the latter registry.. you can create your own or just augment it with your own set of commands that you want to make available through PSCommandService.

#### o365Utils.js

This script simply exports a few useful pre-defined parameter sets (that one would pass to the constructor of StatefulProcessComamndProxy) for the initialization, destruction and auto-invalidation of "powershell" processes who connect to o365 and establish a remote PSSession that will be long lived. (and validate that the session is still legit)

### <a name="usage"></a>Usage

1) Configure your o365 tenant with a user with the appropriate permissions to manage o365 via Powershell. [See this article to get going](https://bitsofinfo.wordpress.com/2015/01/06/configuring-powershell-for-azure-ad-and-o365-exchange-management/)

2) Use [powershell-credential-encryption-tools](https://github.com/bitsofinfo/powershell-credential-encryption-tools) to create an encrypted credentials file and secret key for decryption. SECURE these files!

3) From within this project install the necessary npm dependencies for this module, including [stateful-process-command-proxy](https://github.com/bitsofinfo/stateful-process-command-proxy). You can checkout the latter manually and do a ```npm install stateful-process-command-proxy```

4) Configure ```example.js``` appropriately, in particular the ```initCommands``` for the StatefulProcessCommandProxy; the paths to the items you created via the second step above

5) Tweak the group that is fetched at the bottom of ```example.js```

7) There is also a unit-test (```test\all.js```) for the command registry in ```o365Utils.js``` which gives an example of usage.

### <a id="history"></a>History

```
v1.0-beta.8 - 2015-???
    - Get-DistributionGroupMember - added "-ResultSize Unlimited" 

v1.0-beta.7 - 2015-02-10
    - Add semi-colins to sanitization
    
v1.0-beta.6 - 2015-02-06
    - Bug fix to injection
    
v1.0-beta.5 - 2015-02-06
    - Further improvement for argument injection
    
v1.0-beta.4 - 2015-02-05
    - Fixes to quote sanitization, bug fixes
    
v1.0-beta.3 - 2015-01-30
    - Tweaks to init commands
    
v1.0-beta.2 - 2015-01-28
    - Whitelisting of commands

v1.0-beta.1 - 2015-01-28
    - Initial version
```

### <a id="related"></a>Related Tools

Have a look at these related projects which support and build on top of this module to provide more functionality

* https://github.com/bitsofinfo/stateful-process-command-proxy - The core dependency of this module, provides the actual bridging between node.js and a pool of external shell processes
* https://github.com/bitsofinfo/powershell-command-executor-ui - Builds on top of powershell-command-executor to provide a simple Node REST API and AngularJS interface for testing the execution of commands in the registry
* https://github.com/bitsofinfo/meteor-shell-command-mgr - Small Meteor app that lets you manage/generate a command registry for powershell-command-executor

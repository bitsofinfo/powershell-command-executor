# powershell-command-executor

Module that provides a registry and gateway for execution powershell commands through long-lived established remote PSSessions

* [Related tools](#related)

### To run the example

1) Configure your o365 tenant with a user with the appropriate permissions to manage o365 via Powershell. [See this article to get going](https://bitsofinfo.wordpress.com/2015/01/06/configuring-powershell-for-azure-ad-and-o365-exchange-management/)

2) Use [powershell-credential-encryption-tools](https://github.com/bitsofinfo/powershell-credential-encryption-tools) to create an encrypted credentials file and secret key for decryption. SECURE these files!

3) From within this project install the necessary npm dependencies for this module, including [stateful-process-command-proxy](https://github.com/bitsofinfo/stateful-process-command-proxy). You can checkout the latter manually and do a ```npm install stateful-process-command-proxy```

4) Configure ```example.js``` appropriately, in particular the ```initCommands``` for the StatefulProcessCommandProxy; the paths to the items you created via the second step above

5) Tweak the group that is fetched at the bottom of ```example.js```

###<a id="related"></a> Related Tools

Have a look at these related projects which support and build on top of this module to provide more functionality

* https://github.com/bitsofinfo/stateful-process-command-proxy - The core dependency of this module, provides the actual bridging between node.js and a pool of external shell processes
* https://github.com/bitsofinfo/powershell-command-executor-ui - Builds on top of powershell-command-executor to provide a simple Node REST API and AngularJS interface for testing the execution of commands in the registry

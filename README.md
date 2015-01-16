# powershell-command-executor

Module that provides a registry and gateway for execution powershell commands through long-lived established remote PSSessions

### To run the example

1) Configure your o365 tenant with a user with the appropriate permissions to manage o365 via Powershell. (See this article to get going)[https://bitsofinfo.wordpress.com/2015/01/06/configuring-powershell-for-azure-ad-and-o365-exchange-management/]

2) Use (powershell-credential-encryption-tools)[https://github.com/bitsofinfo/powershell-credential-encryption-tools] to create an encrypted credentials file and secret key for decryption. SECURE these files!

3) From within this project install the necessary npm dependencies for this module, including (stateful-process-command-proxy)[https://github.com/bitsofinfo/stateful-process-command-proxy]. You can checkout the latter manually and do a ```npm install /path/to/stateful-process-command-proxy```

4) Configure ```example.js``` appropriately, in particular the ```initCommands``` for the StatefulProcessCommandProxy; the paths to the items you created via the second step above

5) Tweak the group that is fetched at the bottom of ```example.js```

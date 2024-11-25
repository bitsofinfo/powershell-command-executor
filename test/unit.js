var assert = require("assert");
var o365Utils = require("../o365Utils");
var PSCommandService = require("../psCommandService");

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
var O365_TENANT_DOMAIN_NAME =
  process.env.O365_TENANT_DOMAIN_NAME || "somedomain.com";

/**
 * Following variables needed to test Certificate based connection to Exchange server
 *
 * @see https: //adamtheautomator.com/exchange-online-powershell-mfa/
 * for setup instructions
 */
var CERTIFICATE = process.env.CERTIFICATE || "xxxxxxxxxx";
var CERTIFICATE_PASSWORD = process.env.CERTIFICATE_PASSWORD || "xxxxxxxxxx";
var APPLICATION_ID =
  process.env.APPLICATION_ID || "00000000-00000000-00000000-00000000";
var TENANT = process.env.TENANT || "your.exhange.domain.name";

const initCommands = [
  "$OutputEncoding = [System.Text.Encoding]::GetEncoding(65001)",
  '$ErrorView = "NormalView"', // works for powershell 7.1
  '$PSStyle.OutputRendering = "PlainText"', // works for powershell 7.2 and above
  '$PSDefaultParameterValues["*:Encoding"] = "utf8"',
];

const initExchangeCommands = [
  "$OutputEncoding = [System.Text.Encoding]::GetEncoding(65001)",
  '$ErrorView = "NormalView"', // works for powershell 7.1
  '$PSStyle.OutputRendering = "PlainText"', // works for powershell 7.2 and above
  '$PSDefaultParameterValues["*:Encoding"] = "utf8"',

  // #1 import some basics
  "Import-Module ExchangeOnlineManagement",
  // #2 create certificate password
  `$CertificatePassword = (ConvertTo-SecureString -String "${CERTIFICATE_PASSWORD}" -AsPlainText -Force)`,
  // #3 Import certificate from base64 string
  `$Certificate = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2([Convert]::FromBase64String("${CERTIFICATE}"), $CertificatePassword, [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]"PersistKeySet")`,
  // #4 connect to exchange
  `Connect-ExchangeOnline -ShowBanner:$false -ShowProgress:$false -Certificate $Certificate -CertificatePassword $CertificatePassword  -AppID ${APPLICATION_ID}  -Organization ${TENANT}`,
];

const preDestroyCommands = [
  "Disconnect-ExchangeOnline -Confirm:$false",
  "Remove-Module ExchangeOnlineManagement -Force",
];

const myLogFunction = (severity, origin, message) => {
  console.log(severity.toUpperCase() + " " + origin + " " + message);
};
const logFunction = (severity, origin, msg) => {
  if (origin != "Pool") {
    console.log(severity.toUpperCase() + " " + origin + " " + msg);
  }
};

const commandRegistry = {
  setClipboard: {
    command: "Set-Clipboard {{{arguments}}}",
    arguments: {
      'Value': {
        quoted: false,
      },
    },
    return: {
      type: 'none'
    },
  },
  getClipboard: {
    command: "Get-Clipboard",
    arguments: {},
    return: {
      type: "text",
    },
  },
};


const StatefulProcessCommandProxy = require("stateful-process-command-proxy");

const testRun = async (done, initCommands, preDestroyCommands) => {
  const statefulProcessCommandProxy = new StatefulProcessCommandProxy({
    name: "o365 RemotePSSession powershell pool",
    max: 1,
    min: 1,
    idleTimeoutMS: 30000,

    logFunction: logFunction,

    processCommand: "pwsh",
    processArgs: ["-Command", "-"],

    processRetainMaxCmdHistory: 30,
    processInvalidateOnRegex: {
      any: [
        {
          regex: ".*nomatch.*",
          flags: "i",
        },
      ],
      stdout: [
        {
          regex: ".*nomatch.*",
        },
      ],
      stderr: [
        {
          regex: ".*nomatch.*",
        },
      ],
    },
    processCwd: null,
    processEnvMap: null,
    processUid: null,
    processGid: null,

    initCommands: initCommands,

    validateFunction: (processProxy) => processProxy.isValid(),

    preDestroyCommands: preDestroyCommands,

    processCmdBlacklistRegex: o365Utils.getO365BlacklistedCommands(),

    processCmdWhitelistRegex: o365Utils.getO365WhitelistedCommands(),

    autoInvalidationConfig: o365Utils.getO365AutoInvalidationConfig(30000),
  });

  const psCommandService = new PSCommandService(
    statefulProcessCommandProxy,
    o365Utils.o365CommandRegistry,
    myLogFunction
  );

  const statusResponse = await psCommandService.execute("getStatus", {});
  if (statusResponse.stderr == '' && statusResponse.stdout == '') {
    console.log('Skipping test as getStatus command failed');
    statefulProcessCommandProxy.shutdown();
    done();
  }

  const random =
    "unitTest" +
    Math.abs(Math.floor(Math.random() * (1000 - 99999 + 1) + 1000));

  const testMailContactName = "amailContact-" + random;
  const testMailContactEmail =
    testMailContactName + "@" + O365_TENANT_DOMAIN_NAME;

  const testOwnerGroupName = "owneragroup-" + random;
  const testOwnerGroupEmail =
    testOwnerGroupName + "@" + O365_TENANT_DOMAIN_NAME;

  const testGroupName = "agroup-" + random;
  const testGroupEmail = testGroupName + "@" + O365_TENANT_DOMAIN_NAME;

  const testGroupName2 = "agroup-2" + random;
  const testGroupEmail2 = testGroupName2 + "@" + O365_TENANT_DOMAIN_NAME;

  const cleanupAndShutdown = async (done, error) => {
    await psCommandService.execute("removeDistributionGroup", {
      Identity: testOwnerGroupEmail,
    });
    await psCommandService.execute("removeDistributionGroup", {
      Identity: testGroupEmail,
    });
    await psCommandService.execute("removeDistributionGroup", {
      Identity: testGroupEmail2,
    });
    await psCommandService.execute("removeMailContact", {
      Identity: testMailContactEmail,
    });

    setTimeout(() => {
      statefulProcessCommandProxy.shutdown();
    }, 5000);

    setTimeout(() => {
      if (error) {
        done(error);
      } else {
        done();
      }
    }, 10000);

    if (error) {
      throw error;
    }
  };

  try {
    const ownerGroupCreateResult = await psCommandService.execute(
      "newDistributionGroup",
      {
        Name: testOwnerGroupName,
        DisplayName: testOwnerGroupName,
        PrimarySmtpAddress: testOwnerGroupEmail,
      }
    );
    assert.equal(ownerGroupCreateResult.stderr, "");

    const testGroupCreateResult = await psCommandService.execute(
      "newDistributionGroup",
      {
        Name: testGroupName,
        DisplayName: testGroupName,
        PrimarySmtpAddress: testGroupEmail,
        ManagedBy: testOwnerGroupEmail,
      }
    );

    assert.equal(testGroupCreateResult.stderr, "");
    assert.equal(testGroupCreateResult.commandName, "newDistributionGroup");

    const distributionGroup = JSON.parse(testGroupCreateResult.stdout);
    try {
      assert.equal(testGroupEmail, distributionGroup.PrimarySmtpAddress);
    } catch (e) {
      cleanupAndShutdown(done, e);
    }
    console.log(
      "distributionGroup created OK: " + distributionGroup.PrimarySmtpAddress
    );

    const testGroup2CreateResult = await psCommandService.execute(
      "newDistributionGroup",
      {
        Name: testGroupName2,
        DisplayName: testGroupName2,
        PrimarySmtpAddress: testGroupEmail2,
        ManagedBy: testOwnerGroupEmail,
      }
    );

    assert.equal(testGroup2CreateResult.stderr, "");
    assert.equal(testGroup2CreateResult.commandName, "newDistributionGroup");

    const distributionGroup2 = JSON.parse(testGroup2CreateResult.stdout);
    try {
      assert.equal(testGroupEmail2, distributionGroup2.PrimarySmtpAddress);
    } catch (e) {
      cleanupAndShutdown(done, e);
    }
    console.log(
      "distributionGroup created OK: " + distributionGroup2.PrimarySmtpAddress
    );

    await psCommandService.executeAll([
      {
        commandName: "addDistributionGroupMember",
        argMap: {
          Identity: testGroupEmail,
          Member: testGroupEmail2,
          BypassSecurityGroupManagerCheck: null,
        },
      },
      {
        commandName: "addDistributionGroupMember",
        argMap: {
          Identity: testGroupEmail,
          Member: testOwnerGroupEmail,
          BypassSecurityGroupManagerCheck: null,
        },
      },
    ]);
    console.log("distributionGroupMembers added OK");

    const groupMembersResult = await psCommandService.execute(
      "getDistributionGroupMember",
      {
        Identity: testGroupEmail,
      }
    );

    assert.equal(groupMembersResult.stderr, "");
    assert.equal(groupMembersResult.commandName, "getDistributionGroupMember");

    var members = JSON.parse(groupMembersResult.stdout);
    try {
      assert.equal(members.length, 2);
    } catch (e) {
      cleanupAndShutdown(done, e);
    }
    console.log("distributionGroup members fetched OK: " + members.length);
    const removeResult = await psCommandService.execute(
      "removeDistributionGroupMember",
      {
        Identity: testGroupEmail,
        Member: testGroupEmail2,
      }
    );
    assert.equal(removeResult.stderr, "");
    assert.equal(removeResult.commandName, "removeDistributionGroupMember");

    console.log(`distributionGroupMember (${testGroupEmail2}) removed OK`);

    const refetchGroupMembersResult = await psCommandService.execute(
      "getDistributionGroupMember",
      {
        Identity: testGroupEmail,
      }
    );
    var members = JSON.parse("[" + refetchGroupMembersResult.stdout + "]");
    try {
      assert.equal(members.length, 1);
      assert.equal(members[0].PrimarySmtpAddress, testOwnerGroupEmail);
    } catch (e) {
      return cleanupAndShutdown(done, e);
    }
    console.log(
      "getDistributionGroupMember fetched OK: only owner group remains " +
        members.length
    );
    const contactResult = await psCommandService.execute("newMailContact", {
      Name: testMailContactName,
      ExternalEmailAddress: testMailContactEmail,
    });

    assert.equal(contactResult.stderr, "");
    assert.equal(contactResult.commandName, "newMailContact");

    console.log("newMailContact added OK: " + testMailContactEmail);
    const getContactResult = await psCommandService.execute("getMailContact", {
      Identity: testMailContactEmail,
    });

    var contact = JSON.parse(getContactResult.stdout);
    try {
      assert.equal(testMailContactEmail, contact.PrimarySmtpAddress);
    } catch (e) {
      cleanupAndShutdown(done, e);
    }
    console.log("getMailContact fetched OK: " + testMailContactEmail);
    await psCommandService.execute("addDistributionGroupMember", {
      Identity: testGroupEmail,
      Member: testMailContactEmail,
    });

    console.log(
      "addDistributionGroupMember mailContact added OK: " + testMailContactEmail
    );
    const getGroupMembersResult = await psCommandService.execute(
      "getDistributionGroupMember",
      {
        Identity: testGroupEmail,
      }
    );

    var members = JSON.parse(getGroupMembersResult.stdout);
    try {
      assert.equal(members.length, 2);
    } catch (e) {
      cleanupAndShutdown(done, e);
    }
    console.log(
      "getDistributionGroupMember fetched OK: one mail contact and one group exist " +
        members.length
    );
    await psCommandService.execute("removeDistributionGroup", {
      Identity: testGroupEmail,
    });

    console.log("distributionGroup removed OK: " + testGroupEmail);

    done();
  } catch (error) {
    cleanupAndShutdown(done, error);
  }
};

describe("test PSCommandService w/ o365CommandRegistry", function () {
  it("Should test all group and mail contact commands then cleanup with Certificate based auth", function (done) {
    this.timeout(120000);
    testRun(done, initExchangeCommands, preDestroyCommands);
  });
  it("Should test whitelist", async function () {
    this.timeout(10000);
    const statefulProcessCommandProxy = new StatefulProcessCommandProxy({
      name: "Powershell pool",
      max: 1,
      min: 1,
      idleTimeoutMS: 30000,

      logFunction: logFunction,
      processCommand: "pwsh",
      processArgs: ["-Command", "-"],
      processRetainMaxCmdHistory: 30,
      processCwd: null,
      processEnvMap: null,
      processUid: null,
      processGid: null,
      initCommands: initCommands,
      processCmdWhitelistRegex: [{ regex: '^Set-Clipboard\\s+.*', flags: 'i' }],
      validateFunction: (processProxy) => processProxy.isValid(),
    });

    const psCommandService = new PSCommandService(
      statefulProcessCommandProxy,
      commandRegistry,
      myLogFunction
    );    

    try {
      const value = "'test clipboard value'";
      const setResult = await psCommandService.execute("setClipboard", {
        Value: value,
      });
      assert.equal(setResult.stderr, "");
      try {
        await psCommandService.execute("getClipboard", {});
      } catch (e) {
        assert.match(e.message, /Command cannot be executed it does not match our set of whitelisted commands/);
      }

      setTimeout(() => {
        statefulProcessCommandProxy.shutdown();
      }, 5000);

      return;
    } catch (e) {
      setTimeout(() => {
        statefulProcessCommandProxy.shutdown();
      }, 5000);
      throw e;
    }
  });
  it("Should test blacklist", async function () {
    this.timeout(10000);
    const statefulProcessCommandProxy = new StatefulProcessCommandProxy({
      name: "Powershell pool",
      max: 1,
      min: 1,
      idleTimeoutMS: 30000,

      logFunction: logFunction,
      processCommand: "pwsh",
      processArgs: ["-Command", "-"],
      processRetainMaxCmdHistory: 30,
      processCwd: null,
      processEnvMap: null,
      processUid: null,
      processGid: null,
      initCommands: initCommands,
      processCmdBlacklistRegex: o365Utils.getO365BlacklistedCommands(),  
      validateFunction: (processProxy) => processProxy.isValid(),
    });
    const extendedCommandRegistry = {...commandRegistry, ...{
      getHistory: {
        command: "Get-History",
        arguments: {},
        return: {
          type: "text",
        },
      },
    }};

    const psCommandService = new PSCommandService(
      statefulProcessCommandProxy,
      extendedCommandRegistry,
      myLogFunction
    );    

    const allowResult = await psCommandService.execute("getClipboard", {});
    assert.equal(allowResult.stderr, "");
    assert.equal(allowResult.stdout, "");
    try {
      await psCommandService.execute("getHistory", {});
    } catch (e) {
      assert.match(e.message, /Command cannot be executed as it matches a blacklist regex pattern/);
    }

    try {
      setTimeout(() => {
        statefulProcessCommandProxy.shutdown();
      }, 5000);

      return;
    } catch (e) {
      setTimeout(() => {
        statefulProcessCommandProxy.shutdown();
      }, 5000);
      throw e;
    }    
  });
  it("Should test validation", async function () {
    this.timeout(10000);
    const statefulProcessCommandProxy = new StatefulProcessCommandProxy({
      name: "Powershell pool",
      max: 1,
      min: 1,
      idleTimeoutMS: 30000,

      logFunction: logFunction,
      processCommand: "pwsh",
      processArgs: ["-Command", "-"],
      processRetainMaxCmdHistory: 30,
      processCwd: null,
      processEnvMap: null,
      processUid: null,
      processGid: null,
      initCommands: initCommands,
      validateFunction: (processProxy) => processProxy.isValid(),
    });

    const psCommandService = new PSCommandService(
      statefulProcessCommandProxy,
      commandRegistry,
      myLogFunction
    );

    const assertClipboard = async (value) => {
      const setResult = await psCommandService.execute("setClipboard", {
        Value: value,
      });
      assert.equal(setResult.stderr, "");
      const getResult = await psCommandService.execute("getClipboard", {});
      assert.equal(getResult.stderr, "");
      return getResult;
    }

    try {
      // non quoted value
      var value = "plain text in clipboard";
      var setResult = await psCommandService.execute("setClipboard", {
        Value: value,
      });
      assert.equal(setResult.stdout, "");
      assert.match(setResult.stderr, /A positional parameter cannot be found that accepts argument/);
      await psCommandService.execute("getClipboard", {});
      // simple multi param value
      var res = await assertClipboard('@{add="test","test2";remove="test3","test4"}');
      assert.equal(res.stdout, "System.Collections.Hashtable");
      // multi params value with unsupported keys
      value = '@{add="test","test2";remove="test3","test4";fake="test5","test6"}';
      setResult = await psCommandService.execute("setClipboard", {
        Value: value,
      });
      assert.equal(setResult.command, 'Set-Clipboard -Value @{Add="test","test2"; Remove="test3","test4"} ');
      assert.equal(setResult.stderr, "");
      getResult = await psCommandService.execute("getClipboard", {});
      assert.equal(getResult.stderr, "");
      assert.equal(getResult.stdout, "System.Collections.Hashtable");
      // sample quoted test
      res = await assertClipboard("'sample text'");
      assert.equal(res.stdout, "sample text");

      // espcaped quotes
      value = "'; Get-ChildItem C:\; '";
      setResult = await psCommandService.execute("setClipboard", {
        Value: value,
      });
      assert.equal(setResult.stderr, "");
      getResult = await psCommandService.execute("getClipboard", {});
      assert.equal(getResult.stdout, "`; Get-ChildItem C:`;");
      // reserved variable
      var res = await assertClipboard('$true');
      assert.equal(res.stdout, "True");

      setTimeout(() => {
        statefulProcessCommandProxy.shutdown();
      }, 5000);

      return;
    } catch (e) {
      setTimeout(() => {
        statefulProcessCommandProxy.shutdown();
      }, 5000);
      throw e;
    }
  });
});

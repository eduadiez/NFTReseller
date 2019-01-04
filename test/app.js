const { assertRevert } = require('@aragon/test-helpers/assertThrow')

const Kernel = artifacts.require('@aragon/core/contracts/kernel/Kernel')
const ACL = artifacts.require('@aragon/core/contracts/acl/ACL')
const DAOFactory = artifacts.require('@aragon/core/contracts/factory/DAOFactory')
const EVMScriptRegistryFactory = artifacts.require('@aragon/core/contracts/factory/EVMScriptRegistryFactory')
const Vault = artifacts.require('@aragon/apps-vault/contracts/Vault')
//const Finance = artifacts.require('@aragon/apps-finance/contracts/Finance')

const getContract = name => artifacts.require(name)

const SimpleERC20 = artifacts.require('SimpleERC20')

const AragonNFT = artifacts.require('@dappnode/aragon-nft/contracts/AragonNFT')

const NFTReseller = artifacts.require('DAppNodeNFTReseller')

contract('NFTReseller', (accounts) => {
  let NFTResellerBase, daoFact, dappnodeNFTReseller, AragonNFTBase, AragonNFTProxy, aragonnft, token, acl, vaultBase, vault //, financeBase, finance

  let APP_MANAGER_ROLE, MINT_ROLE, ANY_ENTITY, RESELLER_MANAGER_ROLE, MANUFACTURER_ROLE, TRANSFER_ROLE
  let CREATE_PAYMENTS_ROLE, CHANGE_PERIOD_ROLE, CHANGE_BUDGETS_ROLE, EXECUTE_PAYMENTS_ROLE, MANAGE_PAYMENTS_ROLE

  const root = accounts[0]
  const owner = accounts[1]
  const other_address = accounts[10]

  const firstTokenId = 100;
  const secondTokenId = 200;
  const thirdTokenId = 300;
  const name = 'AragonNFT';
  const symbol = 'AragonNFT';
  const PERIOD_DURATION = 60 * 60 * 24 // One day in seconds

  const erc20Price = 100e18;
  const ethPrice = new web3.BigNumber(1e18);

  before(async () => {
    const kernelBase = await getContract('Kernel').new(true) // petrify immediately
    const aclBase = await getContract('ACL').new()
    const regFact = await EVMScriptRegistryFactory.new()
    daoFact = await DAOFactory.new(kernelBase.address, aclBase.address, regFact.address)
    vaultBase = await Vault.new()
    //financeBase = await Finance.new()


    AragonNFTBase = await AragonNFT.new({ from: root })
    NFTResellerBase = await NFTReseller.new({ from: root })

    // Setup constants
    APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
    ANY_ENTITY = await aclBase.ANY_ENTITY()
    MINT_ROLE = await AragonNFTBase.MINT_ROLE()
    /*
    CREATE_PAYMENTS_ROLE = await financeBase.CREATE_PAYMENTS_ROLE()
    CHANGE_PERIOD_ROLE = await financeBase.CHANGE_PERIOD_ROLE()
    CHANGE_BUDGETS_ROLE = await financeBase.CHANGE_BUDGETS_ROLE()
    EXECUTE_PAYMENTS_ROLE = await financeBase.EXECUTE_PAYMENTS_ROLE()
    MANAGE_PAYMENTS_ROLE = await financeBase.MANAGE_PAYMENTS_ROLE()
    */
    TRANSFER_ROLE = await vaultBase.TRANSFER_ROLE()
  })



  beforeEach(async () => {
    const r = await daoFact.newDAO(root)
    const dao = Kernel.at(r.logs.filter(l => l.event == 'DeployDAO')[0].args.dao)

    acl = ACL.at(await dao.acl())
    await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })


    // vault
    const receiptVault = await dao.newAppInstance('0x1111', vaultBase.address, '0x', false, { from: root })
    vault = Vault.at(receiptVault.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)
    await acl.createPermission(ANY_ENTITY, vault.address, TRANSFER_ROLE, root, { from: root })
    await vault.initialize()

    // finance
    /*
    const receiptFinance = await dao.newAppInstance('0x5678', financeBase.address, '0x', false, { from: root })
    finance = Finance.at(receiptFinance.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)
    //await financeApp.mock_setMaxPeriodTransitions(MAX_UINT64)
    await finance.initialize(vault.address, PERIOD_DURATION)

    await acl.createPermission(ANY_ENTITY, finance.address, CREATE_PAYMENTS_ROLE, root, { from: root })
    await acl.createPermission(ANY_ENTITY, finance.address, CHANGE_PERIOD_ROLE, root, { from: root })
    await acl.createPermission(ANY_ENTITY, finance.address, CHANGE_BUDGETS_ROLE, root, { from: root })
    await acl.createPermission(ANY_ENTITY, finance.address, EXECUTE_PAYMENTS_ROLE, root, { from: root })
    await acl.createPermission(ANY_ENTITY, finance.address, MANAGE_PAYMENTS_ROLE, root, { from: root })
    */

    const receiptAragonNFT = await dao.newAppInstance('0x2222', AragonNFTBase.address, '0x', true, { from: root })
    aragonnft = AragonNFT.at(receiptAragonNFT.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)
    aragonnft.initialize(name, symbol);
    token = await SimpleERC20.new({ from: root })

    const receipt = await dao.newAppInstance('0x1234', NFTResellerBase.address, '0x', true, { from: root })
    dappnodeNFTReseller = NFTReseller.at(receipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)

    await acl.createPermission(ANY_ENTITY, aragonnft.address, MINT_ROLE, root, { from: root })
    RESELLER_MANAGER_ROLE = await dappnodeNFTReseller.RESELLER_MANAGER_ROLE()
    MANUFACTURER_ROLE = await dappnodeNFTReseller.MANUFACTURER_ROLE()

  })

  it('should revert if it tries to initialize the AragonNFT with 0x0', async () => {
    return assertRevert(async () => {
      await dappnodeNFTReseller.initialize(0, vault.address)
    })
  })

  it('should revert if it tries to initialize the VaultApp with 0x0', async () => {
    return assertRevert(async () => {
      await dappnodeNFTReseller.initialize(aragonnft.address, 0)
    })
  })

  describe('Testing DAppNodeNFTReseller', function() {

    beforeEach(async () => {
      await dappnodeNFTReseller.initialize(aragonnft.address, vault.address)
    })

    it('should be initialized', async () => {
      assert.equal(await dappnodeNFTReseller.aragonNFT(), aragonnft.address)
      assert.equal(await dappnodeNFTReseller.vault(), vault.address)
    })

    it('should revert if trying to initialize twice', async () => {
      return assertRevert(async () => {
        await dappnodeNFTReseller.initialize(aragonnft.address, vault.address)
      })
    })

    it('should revert if it does not have permission to change the price', async () => {
      return assertRevert(async () => {
        await dappnodeNFTReseller.setNFTPrice(ethPrice, { from: owner })
      })
    })

    it('should revert if it does not have permission to change the ERC20 price', async () => {
      return assertRevert(async () => {
        await dappnodeNFTReseller.setERC20Price(token.address, erc20Price, { from: owner })
      })
    })

    describe('Test get generic NFTs with ether', function() {

      beforeEach(async () => {
        await acl.createPermission(root, dappnodeNFTReseller.address, RESELLER_MANAGER_ROLE, root, { from: root })
        await dappnodeNFTReseller.setNFTPrice(ethPrice, { from: root })
      })


      it('should revert if the price in Eth is 0', async () => {
        await dappnodeNFTReseller.setNFTPrice(0, { from: root })
        return assertRevert(async () => {
          await dappnodeNFTReseller.getNFT(owner, firstTokenId, { from: owner, value: ethPrice })
        })
      })

      it('should revert if not enough ether is sent', async () => {
        return assertRevert(async () => {
          await dappnodeNFTReseller.getNFT(owner, firstTokenId, { from: owner, value: (ethPrice / 2) })
        })
      })

      it('should revert if too much ether is sent', async () => {
        return assertRevert(async () => {
          await dappnodeNFTReseller.getNFT(owner, firstTokenId, { from: owner, value: (ethPrice / 2) })
        })
      })

      it('should mint the NFT if the correct amount is sent', async () => {
        var previusBalance = await web3.eth.getBalance(vault.address);
        await dappnodeNFTReseller.getNFT(owner, firstTokenId, { from: owner, value: ethPrice })
        assert.equal(await web3.eth.getBalance(vault.address).toString(), ethPrice.plus(previusBalance).toString())
      })
    })

    describe('Test get generic NFTs with an ERC20', function() {

      beforeEach(async () => {
        await acl.createPermission(root, dappnodeNFTReseller.address, RESELLER_MANAGER_ROLE, root, { from: root })
        await dappnodeNFTReseller.setERC20Price(token.address, erc20Price, { from: root })
      })

      it('should revert if trying to set the price for the 0x0 address', async () => {
        return assertRevert(async () => {
          await dappnodeNFTReseller.setERC20Price(0, erc20Price, { from: root })
        })
      })

      it('should be able to set the price if he has permission', async () => {
        await dappnodeNFTReseller.setERC20Price(token.address, erc20Price, { from: root })
      })

      it('should be able to get the price of a ERC20', async () => {
        assert.equal((await dappnodeNFTReseller.getERC20Price(token.address, { from: owner })).toString(), erc20Price)
      })

      it('should revert when querying the 0x0 address', async () => {
        return assertRevert(async () => {
          await dappnodeNFTReseller.getERC20Price(0, { from: owner })
        })
      })

      it('should revert if the price is 0', async () => {
        return assertRevert(async () => {
          await dappnodeNFTReseller.getNFTwithERC20(owner, firstTokenId, vault.address, { from: owner })
        })
      })

      it('should revert if it does not have enough balance', async () => {
        return assertRevert(async () => {
          await dappnodeNFTReseller.getNFTwithERC20(owner, firstTokenId, token.address, { from: owner })
        })
      })

      it('should revert if this it does not have enough allowance (1/2)', async () => {
        token.transfer(owner, erc20Price, { from: root })
        await token.approve(dappnodeNFTReseller.address, erc20Price / 2, { from: owner })
        return assertRevert(async () => {
          await dappnodeNFTReseller.getNFTwithERC20(owner, firstTokenId, token.address, { from: owner })
        })
      })

      it('should mint the NFT if the correct allowance and exact balance', async () => {
        await token.transfer(owner, erc20Price, { from: root })
        await token.approve(dappnodeNFTReseller.address, erc20Price, { from: owner })
        await dappnodeNFTReseller.getNFTwithERC20(owner, firstTokenId, token.address, { from: owner })
        assert.equal((await token.balanceOf(vault.address)).toString(), erc20Price)
      })

      it('should mint a radom token, I should not be able to choose it', async () => {
        await token.transfer(owner, erc20Price, { from: root })
        await token.approve(dappnodeNFTReseller.address, erc20Price, { from: owner })
        await dappnodeNFTReseller.getNFTwithERC20(owner, firstTokenId, token.address, { from: owner })
        assert.isNotTrue(await aragonnft.exists(firstTokenId));
        assert.lengthOf(await aragonnft.tokensOfOwner(owner), 1);
      })

    })

    describe('Test get buy manufacturer NFTs', function() {
      beforeEach(async () => {
        await acl.createPermission(root, dappnodeNFTReseller.address, RESELLER_MANAGER_ROLE, root, { from: root })
        await acl.createPermission(root, dappnodeNFTReseller.address, MANUFACTURER_ROLE, root, { from: root })
        await dappnodeNFTReseller.setERC20Price(token.address, erc20Price, { from: root })
      })

      it('should revert if he does not have permissions', async () => {
        return assertRevert(async () => {
          await dappnodeNFTReseller.buyManufacturerNFT(token.address, erc20Price, "0x123456789", "0x1", "0x2", "0x3", "0x4", "0x5")
        })
      })

      it('should revert if the manufactor does not have permissions to mint the tokenId at that price', async () => {
        var price = 5
        var manu = "0x1234567890123456"
        await acl.grantPermissionP(owner, dappnodeNFTReseller.address, MANUFACTURER_ROLE, getParams(price, manu), { from: root })
        await token.transfer(owner, price / 2, { from: root })
        await token.approve(dappnodeNFTReseller.address, price / 2, { from: owner })

        return assertRevert(async () => {
          await dappnodeNFTReseller.buyManufacturerNFT(token.address, price / 2, manu, "0x1", "0x2", "0x3", "0x4", "0x5", { from: owner })
        })
      })

      it('sshould revert if the manufactor does not have permissions to mint the tokenId', async () => {
        var price = 5
        var manu = "0x1234567890123456"
        await acl.grantPermissionP(owner, dappnodeNFTReseller.address, MANUFACTURER_ROLE, getParams(price, manu), { from: root })
        await token.transfer(owner, price / 2, { from: root })
        await token.approve(dappnodeNFTReseller.address, price / 2, { from: owner })

        return assertRevert(async () => {
          await dappnodeNFTReseller.buyManufacturerNFT(token.address, price, "0x1111111111111111", "0x1", "0x2", "0x3", "0x4", "0x5", { from: owner })
        })
      })

      it('should revert if the manufactor does not have permissions to mint using an specific ERC20', async () => {
        var price = 5
        var manu = "0x1234567890123456"
        await acl.grantPermissionP(owner, dappnodeNFTReseller.address, MANUFACTURER_ROLE, getParams(price, manu), { from: root })
        await token.transfer(owner, price / 2, { from: root })
        await token.approve(dappnodeNFTReseller.address, price / 2, { from: owner })

        return assertRevert(async () => {
          await dappnodeNFTReseller.buyManufacturerNFT("0xccc014e5735bbd21928384142e6460b452f63a26", price, manu, "0x1", "0x2", "0x3", "0x4", "0x5", { from: owner })
        })
      })


      it('should mint if the manufactor have permissions to mint the tokenId, at a some price for some ERC20', async () => {
        var price = 5
        var manu = "0x1234567890123456"
        await acl.grantPermissionP(owner, dappnodeNFTReseller.address, MANUFACTURER_ROLE, getParams(price, manu) , { from: root })
        await token.transfer(owner, price, { from: root })
        await token.approve(dappnodeNFTReseller.address, price, { from: owner })
        await dappnodeNFTReseller.buyManufacturerNFT(token.address, price, manu, "0x1", "0x2", "0x3", "0x4", "0x5", { from: owner })
      })

    })

    toPaddedHexString = (num, len) => { str = num.toString(16); return "0".repeat(len - str.length) + str; }

    function getParams(price = 5, manu = "0x1234567890123456"){
      const LOGIC_OP_PARAM_ID = 204     //LOGIC_OP_PARAM_ID (id = 204)  
      const PARAM_VALUE_PARAM_ID = 205  //PARAM_VALUE_PARAM_ID (id = 205)
      // Enum Op { NONE, EQ, NEQ, GT, LT, GTE, LTE, RET, NOT, AND, OR, XOR, IF_ELSE } // op types
      const EQ = 1 
      const RET = 7 
      const IF_ELSE = 12 
      const ARG_0 = 0
      const ARG_1 = 1
      const ARG_2 = 2

      var argId_0 = toPaddedHexString(LOGIC_OP_PARAM_ID.toString(16), 2);
      var op_0 = toPaddedHexString(IF_ELSE.toString(16), 2);
      var value_0 = "000000000000000000000000000000000000000000070000000200000001";
      const param_0 = new web3.BigNumber(`0x${argId_0}${op_0}${value_0}`)
      console.log(`param_0: ${argId_0}${op_0}${value_0}`)

      var argId_1 = toPaddedHexString(ARG_0.toString(16), 2);
      var op_1 = toPaddedHexString(EQ.toString(16), 2);
      var value_1 = toPaddedHexString(token.address.slice(2), 60);
      const param_1 = new web3.BigNumber(`0x${argId_1}${op_1}${value_1}`)
      console.log(`param_1: ${argId_1}${op_1}${value_1}`)

      var argId_2 = toPaddedHexString(LOGIC_OP_PARAM_ID.toString(16), 2);
      var op_2 = toPaddedHexString(IF_ELSE.toString(16), 2);
      var value_2 = "000000000000000000000000000000000000000000070000000400000003";
      const param_2 = new web3.BigNumber(`0x${argId_2}${op_2}${value_2}`)
      console.log(`param_2: ${argId_2}${op_2}${value_2}`)

      var argId_3 = toPaddedHexString(ARG_1.toString(16), 2);
      var op_3 = toPaddedHexString(EQ.toString(16), 2);
      var value_3 = toPaddedHexString(price.toString(16), 60);
      const param_3 = new web3.BigNumber(`0x${argId_3}${op_3}${value_3}`)
      console.log(`param_3: ${argId_3}${op_3}${value_3}`)

      var argId_4 = toPaddedHexString(LOGIC_OP_PARAM_ID.toString(16), 2);
      var op_4 = toPaddedHexString(IF_ELSE.toString(16), 2);
      var value_4 = "000000000000000000000000000000000000000000070000000600000005";
      const param_4 = new web3.BigNumber(`0x${argId_4}${op_4}${value_4}`)
      console.log(`param_4: ${argId_4}${op_4}${value_4}`)

      var argId_5 = toPaddedHexString(ARG_2.toString(16), 2);
      var op_5 = toPaddedHexString(EQ.toString(16), 2);
      var value_5 = toPaddedHexString(manu.slice(2).toString(16), 60);
      const param_5 = new web3.BigNumber(`0x${argId_5}${op_5}${value_5}`)
      console.log(`param_5: ${argId_5}${op_5}${value_5}`)

      var argId_6 = toPaddedHexString(PARAM_VALUE_PARAM_ID.toString(16), 2);
      var op_6 = toPaddedHexString(RET.toString(16), 2);
      var value_6 = toPaddedHexString("1", 60);
      const param_6 = new web3.BigNumber(`0x${argId_6}${op_6}${value_6}`)
      console.log(`param_6: ${argId_6}${op_6}${value_6}`)

      var argId_7 = toPaddedHexString(PARAM_VALUE_PARAM_ID.toString(16), 2);
      var op_7 = toPaddedHexString(RET.toString(16), 2);
      var value_7 = toPaddedHexString("0", 60);
      const param_7 = new web3.BigNumber(`0x${argId_7}${op_7}${value_7}`)
      console.log(`param_7: ${argId_7}${op_7}${value_7}`)

      return [param_0, param_1, param_2, param_3, param_4, param_5, param_6, param_7]; 

    }
  })
})

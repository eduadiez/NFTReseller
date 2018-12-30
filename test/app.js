const { assertRevert } = require('@aragon/test-helpers/assertThrow')

const Kernel = artifacts.require('@aragon/core/contracts/kernel/Kernel')
const ACL = artifacts.require('@aragon/core/contracts/acl/ACL')
const DAOFactory = artifacts.require('@aragon/core/contracts/factory/DAOFactory')
const EVMScriptRegistryFactory = artifacts.require('@aragon/core/contracts/factory/EVMScriptRegistryFactory')

const getContract = name => artifacts.require(name)


const AragonNFT = artifacts.require('@aragon/core/contracts/factory/EVMScriptRegistryFactory')

const NFTReseller = artifacts.require('NFTReseller.sol')

contract('NFTReseller', (accounts) => {
  let NFTResellerBase, daoFact, nftreseller, AragonNFTBase, aragonnft

  let APP_MANAGER_ROLE

  const root = accounts[0]
  const holder = accounts[1]

  before(async () => {
    const kernelBase = await getContract('Kernel').new(true) // petrify immediately
    const aclBase = await getContract('ACL').new()
    const regFact = await EVMScriptRegistryFactory.new()
    daoFact = await DAOFactory.new(kernelBase.address, aclBase.address, regFact.address)

    AragonNFTBase = await AragonNFT.new()
    NFTResellerBase = await NFTReseller.new()

    // Setup constants
    APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()

  })

  beforeEach(async () => {
    const r = await daoFact.newDAO(root)
    const dao = Kernel.at(r.logs.filter(l => l.event == 'DeployDAO')[0].args.dao)
    const acl = ACL.at(await dao.acl())

    await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })

    const receiptAragonNFT = await dao.newAppInstance('0x1111', AragonNFTBase.address, '0x', false, { from: root })
    aragonnft = AragonNFT.at(receiptAragonNFT.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)

    const receipt = await dao.newAppInstance('0x1234', NFTResellerBase.address, '0x', false, { from: root })
    nftreseller = NFTReseller.at(receipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)
  })

  it('should be initialized', async () => {
      await nftreseller.initialize(aragonnft.address)
  })
})

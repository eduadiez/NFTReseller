var NFTReseller = artifacts.require('NFTReseller.sol')

module.exports = function (deployer) {
  deployer.deploy(NFTReseller)
}

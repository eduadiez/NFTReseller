pragma solidity ^0.4.24;

import "@aragon/os/contracts/lib/math/SafeMath.sol";
import "@dappnode/aragon-nft/contracts/AragonNFT.sol";


contract NFTReseller is AragonApp {
    using SafeMath for uint256;

    AragonNFT public aragonNFT;

    function initialize(address _aragonNFT) public onlyInit {
        aragonNFT = AragonNFT(_aragonNFT);
        initialized();
    }
}

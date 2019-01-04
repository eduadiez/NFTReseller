pragma solidity 0.4.24;

import "@aragon/apps-vault/contracts/Vault.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";
import "@aragon/os/contracts/acl/ACLSyntaxSugar.sol";

import "@dappnode/aragon-nft/contracts/AragonNFT.sol";

contract NFTReseller is AragonApp {
    using SafeMath for uint256;

    // TODO ADD EVENTS
    // TODO ADD COMMENTS
    // TODO CLEAN AND LINT

    /// ACL
    bytes32 constant public RESELLER_MANAGER_ROLE = keccak256("RESELLER_MANAGER_ROLE");

    AragonNFT public aragonNFT;
    Vault public vault;
    uint256 public tokenPrice;

    mapping (address => uint256) public ERC20Payments;

    function initialize(AragonNFT _aragonNFT, Vault _vault) public onlyInit {
        require(isContract(_aragonNFT));
        require(isContract(_vault));
        vault = _vault;
        aragonNFT = _aragonNFT;
        initialized();
    }

    function setNFTPrice(uint256 _price) public auth(RESELLER_MANAGER_ROLE) {
        tokenPrice = _price;
    }

    function setERC20Price(address _tokenERC20, uint256 _price) public auth(RESELLER_MANAGER_ROLE) {
        require(isContract(_tokenERC20));
        ERC20Payments[_tokenERC20] = _price;
    }

    function getERC20Price(address _tokenERC20) public view returns(uint256) {
        require(_tokenERC20 != address(0));
        return ERC20Payments[_tokenERC20];
    }

    function getNFT(address _to, uint256 _tokenId) public payable {
        require(tokenPrice != 0);
        require(_to != address(0));
        require(msg.value == tokenPrice);
        vault.send(tokenPrice);
        //finance.deposit.value(msg.value)(ETH, tokenPrice, "getNFT");
        aragonNFT.mint(_to, _tokenId);
    } 

    function getNFTwithERC20(address _to, uint256 _tokenId, address _tokenERC20 ) public {
        require(_to != address(0));
        uint256 price = ERC20Payments[_tokenERC20];
        require(price != 0);
        require(ERC20(_tokenERC20).balanceOf(msg.sender) >= price);
        require(ERC20(_tokenERC20).allowance(msg.sender, this) >= price);
        require(ERC20(_tokenERC20).transferFrom(msg.sender, vault, price));
        //finance.deposit(_tokenERC20, price, "getNFTwithERC20");
        aragonNFT.mint(_to, _tokenId);
    } 
}


contract DAppNodeNFTReseller is ACLSyntaxSugar, AragonApp, NFTReseller {

    bytes8 constant private MANUFACTURER = bytes8(0x444170704e6f6465);
    bytes6 constant private EXTRA = bytes6(0x205468616E6B20);
    bytes2 constant private MODEL = bytes2(0x796F);
    bytes2 constant private VERSION = bytes2(0x7521);
    bytes2 constant private SERIAL = bytes2(0x2121);
    uint48 constant private MAX_ID = uint48(2**48-1);

    /// ACL
    bytes32 constant public MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");

    function initialize(AragonNFT _aragonNFT, Vault _vault) public onlyInit {
        super.initialize(_aragonNFT, _vault);
    }

    function getNFT(address _to, uint256 _tokenId) public payable {
        getGenericNFT();
    } 
    
    function getNFTwithERC20(address _to, uint256 _tokenId, address _tokenERC20 ) public {
        getGenericNFT(_tokenERC20);
    }

    function getGenericNFT(address _tokenERC20) public {
        super.getNFTwithERC20(msg.sender, uint256(generatePublicTokenID()), _tokenERC20);
    }

    function getGenericNFT() public payable {
        super.getNFT(msg.sender, uint256(generatePublicTokenID()));
    }
    
    function buyManufacturerNFT(
        address _tokenERC20,
        uint256 _price,
        bytes8 _manufacturer, 
        bytes6 _extra, 
        bytes2 _model,
        bytes2 _version,
        bytes2 _serial,
        bytes6 _id)
    public authP(MANUFACTURER_ROLE, arr(_tokenERC20,_price,uint256(_manufacturer))) returns (bytes32)
    {
        require(ERC20(_tokenERC20).balanceOf(msg.sender) >= _price);
        require(ERC20(_tokenERC20).allowance(msg.sender, this) >= _price);
        require(ERC20(_tokenERC20).transferFrom(msg.sender, vault, _price));
        aragonNFT.mint(msg.sender, uint256(_generateTokenID(_manufacturer, _extra, _model, _version, _serial, _id)));
    }    

    function _generateTokenID(
        bytes8 _manufacturer, 
        bytes6 _extra, 
        bytes2 _model,
        bytes2 _version,
        bytes2 _serial,
        bytes6 _id) 
    internal returns (bytes32)
    {
        bytes32 result;
        bytes memory source = abi.encodePacked(_manufacturer, _extra, _model, _version, _serial, bytes6(block.timestamp), _id);
        assembly {
            result := mload(add(source, 32))
        }
        return result;
    }
    
    function generatePublicTokenID() internal returns (bytes32) {
        return _generateTokenID(
            MANUFACTURER,
            EXTRA,
            MODEL,
            VERSION,
            SERIAL,
            bytes6(_randomId(MAX_ID)));
    }
    
    function _randomId (uint256 _limit) internal returns (uint256) {
        return uint256(keccak256(abi.encodePacked(block.timestamp, block.difficulty)))%_limit;
    }
}


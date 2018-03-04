pragma solidity ^0.4.20;

contract AmountCheckable {
  modifier minAmount(uint w) {
    require(msg.value >= w);
    _;
  }
  modifier exactlyAmount(uint w) {
    require(msg.value == w);
    _;
  }
  modifier maxAmount(uint w) {
    require(msg.value <= w);
    _;
  }
}

contract Coinflipping is AmountCheckable {
  address public player1;
  address public player2;
  uint public wager;
  uint public seedBlockNumber;
  enum GameState {noWager, wagerMadeByPlayer1, wagerAccepted}
  GameState public currentState;
  modifier onlyState(GameState gs) {
    require(currentState == gs);
    _;
  }

  function Coinflipping() public payable {
    currentState = GameState.noWager;
  }

  function makeWager() onlyState(GameState.noWager) minAmount(1e18) public payable {
    player1 = msg.sender;
    wager = msg.value;
    currentState = GameState.wagerMadeByPlayer1;
  }

  function acceptWager() onlyState(GameState.wagerMadeByPlayer1) exactlyAmount(wager) public payable {
    player2 = msg.sender;
    currentState = GameState.wagerAccepted;
    seedBlockNumber = block.number;
  }

  function resolve() onlyState(GameState.wagerAccepted) public {
    uint256 blockValue = uint256(block.blockhash(seedBlockNumber));
    uint256 FACTOR = 57896044618658097711785492504343953926634992332820282019728792003956564819968; //2^256/2
    uint256 coinFlip = uint256(blockValue / FACTOR);

    if (coinFlip == 0) {
      player1.transfer(this.balance);
    } else {
      player2.transfer(this.balance);
    }
    currentState = GameState.noWager;
  }

  function getState() public returns (string) {
    if (currentState == GameState.noWager) {
      return "no wager";
    } else if (currentState == GameState.wagerMadeByPlayer1) {
      return "wager made by first player";
    } else {
      return "wager was accepted";
    }
  }

  function kill() public {                 
    if (currentState == GameState.wagerMadeByPlayer1 && msg.sender == player1) {
      selfdestruct(player1); 
    }
  }

}
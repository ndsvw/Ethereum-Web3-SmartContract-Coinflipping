const Web3 = require("web3");
const solc = require("solc");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

let getBalance = (acc) => {
  return new Promise((res, rej) => {
    let balance = web3.eth.getBalance(acc).then((data, error) => {
      if (!error) {
        let ethers = web3.utils.fromWei(data, "ether");
        res(ethers);
      } else {
        rej("Requesting balance failed.");
      }
    });
  }).catch((e) => {
    console.error(e)
  })
}

let source = `pragma solidity ^0.4.20;
contract Coinflipping {
  address public player1;
  address public player2;
  uint public wager;
  uint public seedBlockNumber;
  enum GameState {noWager, wagerMadeByPlayer1, wagerAccepted}
  GameState public currentState;

  function Coinflipping() public payable {
    currentState = GameState.noWager;
  }

  function makeWager() public payable {
    if (currentState == GameState.noWager) {
      if (msg.value >= 1e18) {
        player1 = msg.sender;
        wager = msg.value;
        currentState = GameState.wagerMadeByPlayer1;
      } else {
        msg.sender.transfer(msg.value);
      }
    } else {
      msg.sender.transfer(msg.value);
    }
  }

  function acceptWager() public payable {
    if (currentState == GameState.wagerMadeByPlayer1) {
      if (msg.value == wager) {
        player2 = msg.sender;
        currentState = GameState.wagerAccepted;
        seedBlockNumber = block.number;
      } else {
        msg.sender.transfer(msg.value);
      }
    } else {
      msg.sender.transfer(msg.value);
    }
  }

  function resolve() public {
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
`

let main = async () => {
  let accounts = await web3.eth.getAccounts();
  let player1 = accounts[0];
  let player2 = accounts[1];

  // compile the solidity code
  let compiled = solc.compile(source);

  // save public interface of contract
  let abi = JSON.parse(compiled.contracts[":Coinflipping"].interface)

  // create var with contract
  let Coinflipping = new web3.eth.Contract(abi);

  // deploy contract
  let deployContractTx = Coinflipping.deploy({
    data: compiled.contracts[':Coinflipping'].bytecode
  });

  let calculatedGas = await deployContractTx.estimateGas();

  let contractInstance = await deployContractTx.send({
    from: player1,
    gas: calculatedGas
  });

  console.log("Before:");
  console.log("\tbalance player1: " + await getBalance(player1));
  console.log("\tbalance player2: " + await getBalance(player2));
  console.log("\tbalance contract: 0");
  console.log("\tGameState: " + await contractInstance.methods.getState().call() + "\n");

  // player 1 makes wage
  await contractInstance.methods.makeWager().send({
    from: player1,
    value: web3.utils.toWei('1', 'ether')
  });

  console.log("After player1 makes wage:");
  console.log("\tbalance player1: " + await getBalance(player1));
  console.log("\tbalance player2: " + await getBalance(player2));
  console.log("\tbalance contract: " + await getBalance(contractInstance.options.address));
  console.log("\tGameState: " + await contractInstance.methods.getState().call() + "\n");

  // player 2 accepts wage
  await contractInstance.methods.acceptWager().send({
    from: player2,
    value: web3.utils.toWei('1', 'ether')
  });

  console.log("After player2 accepts wage:");
  console.log("\tbalance player1: " + await getBalance(player1));
  console.log("\tbalance player2: " + await getBalance(player2));
  console.log("\tbalance contract: " + await getBalance(contractInstance.options.address));
  console.log("\tGameState: " + await contractInstance.methods.getState().call() + "\n");

  // player 2 resolves
  await contractInstance.methods.resolve().send({
    from: player2
  });

  console.log("After someone resolved the contract:");
  console.log("\tbalance player1: " + await getBalance(player1));
  console.log("\tbalance player2: " + await getBalance(player2));
  console.log("\tbalance contract: " + await getBalance(contractInstance.options.address));
  console.log("\tGameState: " + await contractInstance.methods.getState().call() + "\n");

}

main();
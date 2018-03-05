const Web3 = require("web3");
const solc = require("solc");
const fs = require("fs");
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

let main = async () => {
  // loading the source code from a solidity file
  let source = fs.readFileSync("./coinflip.sol", "utf8");

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
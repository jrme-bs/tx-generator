const { ethers } = require('ethers');
const readline = require('readline');

// ABIs pour differentes fonctions
const ABIS = {
  approve: ["function approve(address spender, uint256 amount) public returns (bool)"],
  deposit: ["function deposit() public payable"],
  withdraw: ["function withdraw(uint256 amount) public"],
  balanceOf: ["function balanceOf(address account) external view returns (uint256)"],
  refundETH: ["function refundETH() external payable"],
  approveMax: ["function approveMax(address token) external payable"],
  approveMaxMinusOne: ["function approveMaxMinusOne(address token) external payable"],
  approveZeroThenMax: ["function approveZeroThenMax(address token) external payable"],
  approveZeroThenMaxMinusOne: ["function approveZeroThenMaxMinusOne(address token) external payable"]
};

// Configuration des contrats par chaîne
function getContracts(chain) {
  const contracts = {};
  
  // Configurer le token wrapped selon la chaîne
  if (chain.name === 'Base Mainnet') {
    contracts.weth = {
      address: chain.weth,
      name: 'WETH (Wrapped ETH)',
      functions: ['deposit', 'withdraw', 'approve', 'revoke'],
      description: 'Wrap/Unwrap ETH + approve/revoke'
    };
  } else if (chain.name === 'HyperEVM') {
    contracts.whype = {
      address: chain.weth,
      name: 'WHYPE (Wrapped HYPE)',
      functions: ['deposit', 'withdraw', 'approve', 'revoke'],
      description: 'Wrap/Unwrap HYPE + approve/revoke'
    };
  }
  
  // Ajouter Uniswap V3 Router seulement pour Base
  if (chain.name === 'Base Mainnet') {
    contracts.uniswap = {
      address: '0x2626664c2603336E57B271c5C0b26F421741e481',
      name: 'Uniswap V3 Router',
      functions: ['refundETH', 'approveMax', 'approveMaxMinusOne', 'approveZeroThenMax', 'approveZeroThenMaxMinusOne'],
      description: 'Uniswap V3 - refund ETH + approve functions'
    };
  }
  
  return contracts;
}

// Configuration des RPC par chaîne
const CHAINS = {
  base: {
    name: 'Base Mainnet',
    rpc: 'https://mainnet.base.org',
    weth: '0x4200000000000000000000000000000000000006',
    gasToken: 'ETH'
  },
  hyperevm: {
    name: 'HyperEVM',
    rpc: 'https://rpc.hyperliquid.xyz/evm',
    weth: '0x5555555555555555555555555555555555555555',
    gasToken: 'HYPE'
  }
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function getRandomContract() {
  const keys = Object.keys(CONTRACTS);
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return { key: randomKey, ...CONTRACTS[randomKey] };
}

function getRandomFunction(contract) {
  const funcs = contract.functions;
  return funcs[Math.floor(Math.random() * funcs.length)];
}

async function main() {
  console.log('===========================================');
  console.log('   BASE ETH TRANSACTION AUTOMATION        ');
  console.log('===========================================\n');

  try {
    // Selectionner la chaîne
    console.log('[CHAIN] Choisissez une chaîne:');
    console.log('  1. Base Mainnet');
    console.log('  2. HyperEVM');
    const chainChoice = await question('\n[CHOICE] Chaine (1 ou 2): ');
    
    let selectedChain;
    if (chainChoice === '1') {
      selectedChain = CHAINS.base;
      console.log('[CHAIN] Base Mainnet selectionnee\n');
    } else if (chainChoice === '2') {
      selectedChain = CHAINS.hyperevm;
      console.log('[CHAIN] HyperEVM selectionnee\n');
    } else {
      console.log('[ERROR] Choix invalide');
      rl.close();
      return;
    }

    // Demander la cle privee
    const privateKey = await question('[KEY] Entrez votre cle privee: ');
    
    if (!privateKey || privateKey.length < 64) {
      console.log('[ERROR] Cle privee invalide');
      rl.close();
      return;
    }

    // Afficher les options
    const CONTRACTS = getContracts(selectedChain);
    console.log('\n[CONTRACTS] Options disponibles:');
    console.log('  0. Mode MULTI-CONTRACT (aleatoire)');
    let index = 1;
    for (const [key, contract] of Object.entries(CONTRACTS)) {
      console.log('  ' + index + '. ' + contract.name + ' - ' + contract.description);
      index++;
    }

    const contractChoice = await question('\n[CHOICE] Choisissez un mode (0 pour multi, 1-2 pour specifique): ');
    const choice = parseInt(contractChoice);

    let selectedContracts = [];
    let multiMode = false;

    if (choice === 0) {
      multiMode = true;
      console.log('[MODE] Mode MULTI-CONTRACT active');
    } else if (choice >= 1 && choice <= Object.keys(CONTRACTS).length) {
      const contractKey = Object.keys(CONTRACTS)[choice - 1];
      selectedContracts = [{ key: contractKey, ...CONTRACTS[contractKey] }];
      console.log('[MODE] Contrat: ' + CONTRACTS[contractKey].name);
    } else {
      console.log('[ERROR] Choix invalide');
      rl.close();
      return;
    }

    // Demander le nombre d'iterations
    const iterations = await question('\n[NUMBER] Nombre de transactions: ');
    const numIterations = parseInt(iterations);

    if (isNaN(numIterations) || numIterations <= 0) {
      console.log('[ERROR] Nombre invalide');
      rl.close();
      return;
    }

    const confirm = await question('\n[CONFIRM] Confirmer? (oui/non): ');
    
    if (confirm.toLowerCase() !== 'oui') {
      console.log('[CANCEL] Annule');
      rl.close();
      return;
    }

    // Connexion
    console.log('\n[CONNECT] Connexion a ' + selectedChain.name + '...');
    const provider = new ethers.JsonRpcProvider(selectedChain.rpc);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log('[WALLET] Adresse: ' + wallet.address);
    
    // Prix adaptés selon la chaîne
    let tokenPrice = selectedChain.gasToken === 'HYPE' ? 35 : 3500; // HYPE ~$35, ETH ~$3500
    console.log('[PRICE] Prix ' + selectedChain.gasToken + ': $' + tokenPrice);
    
    const maxGasCostUSD = 0.05; // 5 centimes
    const maxGasCostToken = maxGasCostUSD / tokenPrice;
    const maxGasWei = ethers.parseEther(maxGasCostToken.toFixed(18));
    console.log('[GAS] Limite: $' + maxGasCostUSD + ' (' + maxGasCostToken.toFixed(6) + ' ' + selectedChain.gasToken + ')\n');
    
    const balance = await provider.getBalance(wallet.address);
    console.log('[BALANCE] Solde: ' + ethers.formatEther(balance) + ' ETH\n');

    if (balance === 0n) {
      console.log('[WARNING] Solde a 0 ETH!');
      rl.close();
      return;
    }

    let successCount = 0;
    let failCount = 0;
    let totalGasUsed = 0n;

    // Boucle de transactions
    for (let i = 0; i < numIterations; i++) {
      // Choisir le contrat
      let targetContract;
      if (multiMode) {
        targetContract = getRandomContract();
      } else {
        targetContract = selectedContracts[0];
      }

      // Choisir la fonction
      const functionName = getRandomFunction(targetContract);
      
      // Montant ETH aleatoire (tres petit pour economiser)
      const minAmount = 0.000001; // 0.000001 ETH minimum
      const maxAmount = 0.000005; // 0.000005 ETH maximum
      const randomAmount = minAmount + (Math.random() * (maxAmount - minAmount));
      const amount = ethers.parseEther(randomAmount.toFixed(9));
      
      console.log('\n==========================================');
      console.log('[TX ' + (i + 1) + '/' + numIterations + '] ' + targetContract.name);
      console.log('   Fonction: ' + functionName);
      console.log('   Amount: ' + ethers.formatEther(amount) + ' ETH');

      try {
        let tx;
        let gasEstimate;
        let feeData = await provider.getFeeData();

        if (functionName === 'deposit') {
          // WETH/WHYPE deposit (wrap ETH/HYPE)
          const contract = new ethers.Contract(targetContract.address, ABIS.deposit, wallet);
          
          gasEstimate = await contract.deposit.estimateGas({ value: amount });
          
          const estimatedCost = gasEstimate * feeData.gasPrice;
          const estimatedCostToken = parseFloat(ethers.formatEther(estimatedCost));
          const estimatedCostUSD = estimatedCostToken * tokenPrice;
          
          console.log('   [GAS] Estime: ' + gasEstimate.toString());
          console.log('   [COST] Estime: ' + estimatedCostToken.toFixed(6) + ' ' + selectedChain.gasToken + ' ($' + estimatedCostUSD.toFixed(4) + ')');
          
          if (estimatedCost > maxGasWei) {
            console.log('   [SKIP] Cout trop eleve');
            failCount++;
            continue;
          }

          tx = await contract.deposit({ value: amount, gasLimit: gasEstimate });

        } else if (functionName === 'withdraw') {
          // WETH/WHYPE withdraw (unwrap ETH/HYPE)
          const contract = new ethers.Contract(targetContract.address, ABIS.withdraw, wallet);
          const balanceContract = new ethers.Contract(targetContract.address, ABIS.balanceOf, wallet);
          
          // Vérifier le solde du token wrapped
          const wethBalance = await balanceContract.balanceOf(wallet.address);
          
          if (wethBalance <= 0n) {
            console.log('   [SKIP] Solde ' + selectedChain.gasToken + ' insuffisant pour withdraw');
            failCount++;
            continue;
          }
          
          gasEstimate = await contract.withdraw.estimateGas(amount);
          
          const estimatedCost = gasEstimate * feeData.gasPrice;
          const estimatedCostToken = parseFloat(ethers.formatEther(estimatedCost));
          const estimatedCostUSD = estimatedCostToken * tokenPrice;
          
          console.log('   [GAS] Estime: ' + gasEstimate.toString());
          console.log('   [COST] Estime: ' + estimatedCostToken.toFixed(6) + ' ' + selectedChain.gasToken + ' ($' + estimatedCostUSD.toFixed(4) + ')');
          
          if (estimatedCost > maxGasWei) {
            console.log('   [SKIP] Cout trop eleve');
            failCount++;
            continue;
          }

          tx = await contract.withdraw(amount, { gasLimit: gasEstimate });

        } else if (functionName === 'approve') {
          // Token approve
          const contract = new ethers.Contract(targetContract.address, ABIS.approve, wallet);
          const spender = '0x2626664c2603336E57B271c5C0b26F421741e481'; // Uniswap
          const approveAmount = ethers.parseEther('1');
          
          console.log('   Spender: ' + spender);
          console.log('   Approve amount: 1 Token');
          
          gasEstimate = await contract.approve.estimateGas(spender, approveAmount);
          
          const estimatedCost = gasEstimate * feeData.gasPrice;
          const estimatedCostToken = parseFloat(ethers.formatEther(estimatedCost));
          const estimatedCostUSD = estimatedCostToken * tokenPrice;
          
          console.log('   [GAS] Estime: ' + gasEstimate.toString());
          console.log('   [COST] Estime: ' + estimatedCostToken.toFixed(6) + ' ' + selectedChain.gasToken + ' ($' + estimatedCostUSD.toFixed(4) + ')');
          
          if (estimatedCost > maxGasWei) {
            console.log('   [SKIP] Cout trop eleve');
            failCount++;
            continue;
          }

          tx = await contract.approve(spender, approveAmount, { gasLimit: gasEstimate });

        } else if (functionName === 'revoke') {
          // Token revoke (approve avec 0)
          const contract = new ethers.Contract(targetContract.address, ABIS.approve, wallet);
          const spender = '0x2626664c2603336E57B271c5C0b26F421741e481'; // Uniswap
          const revokeAmount = 0; // Montant 0 = revoke
          
          console.log('   Spender: ' + spender);
          console.log('   Action: REVOKE (montant 0)');
          
          gasEstimate = await contract.approve.estimateGas(spender, revokeAmount);
          
          const estimatedCost = gasEstimate * feeData.gasPrice;
          const estimatedCostToken = parseFloat(ethers.formatEther(estimatedCost));
          const estimatedCostUSD = estimatedCostToken * tokenPrice;
          
          console.log('   [GAS] Estime: ' + gasEstimate.toString());
          console.log('   [COST] Estime: ' + estimatedCostToken.toFixed(6) + ' ' + selectedChain.gasToken + ' ($' + estimatedCostUSD.toFixed(4) + ')');
          
          if (estimatedCost > maxGasWei) {
            console.log('   [SKIP] Cout trop eleve');
            failCount++;
            continue;
          }

          tx = await contract.approve(spender, revokeAmount, { gasLimit: gasEstimate });

        } else if (functionName === 'refundETH') {
          // Uniswap refundETH
          const contract = new ethers.Contract(targetContract.address, ABIS.refundETH, wallet);
          
          console.log('   Action: Refund ETH');
          
          gasEstimate = await contract.refundETH.estimateGas({ value: amount });
          
          const estimatedCost = gasEstimate * feeData.gasPrice;
          const estimatedCostToken = parseFloat(ethers.formatEther(estimatedCost));
          const estimatedCostUSD = estimatedCostToken * tokenPrice;
          
          console.log('   [GAS] Estime: ' + gasEstimate.toString());
          console.log('   [COST] Estime: ' + estimatedCostToken.toFixed(6) + ' ETH ($' + estimatedCostUSD.toFixed(4) + ')');
          
          if (estimatedCost > maxGasWei) {
            console.log('   [SKIP] Cout trop eleve');
            failCount++;
            continue;
          }

          tx = await contract.refundETH({ value: amount, gasLimit: gasEstimate });

        } else if (functionName === 'approveMax' || functionName === 'approveMaxMinusOne' || functionName === 'approveZeroThenMax' || functionName === 'approveZeroThenMaxMinusOne') {
          // Uniswap approve functions
          const contract = new ethers.Contract(targetContract.address, ABIS[functionName], wallet);
          const tokenAddress = '0x4200000000000000000000000000000000000006'; // WETH
          
          console.log('   Token: ' + tokenAddress);
          console.log('   Function: ' + functionName);
          
          gasEstimate = await contract[functionName].estimateGas(tokenAddress);
          
          const estimatedCost = gasEstimate * feeData.gasPrice;
          const estimatedCostToken = parseFloat(ethers.formatEther(estimatedCost));
          const estimatedCostUSD = estimatedCostToken * tokenPrice;
          
          console.log('   [GAS] Estime: ' + gasEstimate.toString());
          console.log('   [COST] Estime: ' + estimatedCostToken.toFixed(6) + ' ETH ($' + estimatedCostUSD.toFixed(4) + ')');
          
          if (estimatedCost > maxGasWei) {
            console.log('   [SKIP] Cout trop eleve');
            failCount++;
            continue;
          }

          tx = await contract[functionName](tokenAddress, { gasLimit: gasEstimate });
        }

        console.log('   [SENT] Hash: ' + tx.hash);
        console.log('   [WAIT] Confirmation...');

        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
          const actualCost = receipt.gasUsed * receipt.gasPrice;
          const actualCostToken = parseFloat(ethers.formatEther(actualCost));
          const actualCostUSD = actualCostToken * tokenPrice;
          totalGasUsed += actualCost;
          
          console.log('   [SUCCESS] Confirme!');
          console.log('   [COST] Reel: ' + actualCostToken.toFixed(6) + ' ' + selectedChain.gasToken + ' ($' + actualCostUSD.toFixed(4) + ')');
          console.log('   [LINK] https://basescan.org/tx/' + tx.hash);
          successCount++;
        } else {
          console.log('   [FAIL] Echouee');
          failCount++;
        }

        // Pause aleatoire 15 secondes - 2 minutes
        if (i < numIterations - 1) {
          const pause = Math.floor(Math.random() * 106) + 15;
          console.log('   [PAUSE] ' + pause + ' secondes...');
          await new Promise(resolve => setTimeout(resolve, pause * 1000));
        }

      } catch (error) {
        console.log('   [ERROR] ' + error.message);
        failCount++;
        
        if (error.message.includes('insufficient funds')) {
          console.log('   [STOP] Solde insuffisant, arret du script');
          break;
        }
        
        const errorPause = Math.floor(Math.random() * 16) + 15;
        console.log('   [PAUSE] ' + errorPause + ' secondes...');
        await new Promise(resolve => setTimeout(resolve, errorPause * 1000));
      }
    }

    // Resume
    console.log('\n===========================================');
    console.log('            RESUME FINAL                   ');
    console.log('===========================================');
    console.log('[SUCCESS] ' + successCount + '/' + numIterations);
    console.log('[FAIL] ' + failCount + '/' + numIterations);
    
    const finalBalance = await provider.getBalance(wallet.address);
    const totalGasToken = parseFloat(ethers.formatEther(totalGasUsed));
    const totalGasUSD = totalGasToken * tokenPrice;
    
    console.log('[BALANCE] Initial: ' + ethers.formatEther(balance) + ' ' + selectedChain.gasToken);
    console.log('[BALANCE] Final: ' + ethers.formatEther(finalBalance) + ' ' + selectedChain.gasToken);
    console.log('[USED] Gas total: ' + totalGasToken.toFixed(6) + ' ' + selectedChain.gasToken + ' ($' + totalGasUSD.toFixed(4) + ')');

  } catch (error) {
    console.error('\n[FATAL] ' + error.message);
  } finally {
    rl.close();
  }
}

main().catch(console.error);
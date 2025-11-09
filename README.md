# tx-generator

Mini README pour `approve_script.js`

## Description

Petit script Node.js (ethers.js) pour automatiser des opérations très limitées sur les tokens wrapped (WETH / WHYPE) et quelques appels utilitaires (refundETH / approveMax...) sur certaines chaînes. Le script propose une sélection de chaîne (Base Mainnet ou HyperEVM), effectue des transactions en petites quantités et gère des pauses aléatoires entre transactions.

## Prérequis

- Node.js (>= 18 recommandé)
- npm
- Une clé privée (compte avec fonds très limités pour tests)

## Installation

Ouvrez PowerShell dans le dossier du projet et installez les dépendances :

```powershell
npm install
```

## Utilisation

Lancer le script et suivez les invites :

```powershell
node approve_script.js
```

Le script vous demandera :
- choisir la chaîne (1 = Base Mainnet, 2 = HyperEVM)
- entrer la clé privée (ne partagez jamais cette clé)
- choisir le mode (multi-contrat ou un contrat précis)
- nombre d'itérations

Le comportement principal :
- effectue des micro-transactions (montants très faibles)
- garde une limite de coût en USD par tx (ex : $0.05) et skippe si l'estimation dépasse
- pause aléatoire entre 15 s et 2 min entre transactions
- avant `withdraw`, le script vérifie le `balanceOf` pour éviter les revert si solde = 0

## Chaînes et adresses (configurées dans le script)

- Base Mainnet : WETH = `0x4200000000000000000000000000000000000006`
- HyperEVM :  WHYPE = `0x5555555555555555555555555555555555555555` (config dans le script)
- Uniswap V3 Router (Base) : `0x2626664c2603336E57B271c5C0b26F421741e481`

## Avertissements de sécurité

- NE PAS partager votre clé privée. Ce script demande la clé en clair pour signer les tx.
- Testez d'abord sur un compte de test ou avec de très faibles fonds.
- Les appels d'écriture (approve/refund/withdraw) dépendent des ABI et du contrat sur chaîne réelle — assurez-vous que le contrat cible supporte la fonction.

## Support & suite

Si vous voulez que j'ajoute :
- un mode lecture seule (simuler tx sans envoyer)
- stockage de la clé via variable d'environnement au lieu d'invite interactif
- logs plus détaillés ou support de réseaux additionnels

Ouvrez une issue ou répondez ici avec ce que vous voulez améliorer.


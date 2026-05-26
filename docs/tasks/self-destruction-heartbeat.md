# Mécanisme d'Auto-destruction pour inactivité via Heartbeat

## 1. Contexte & Discussion (Narratif)
> *Style Handover : Raconte pourquoi on fait ça.*
Lors du déploiement de plusieurs instances de `dvc-viewer` sur le Headnode du cluster pour le visionnage d'historiques par projet, l'absence de mécanisme d'arrêt automatique entraînait une prolifération de processus zombies FastAPI. Ces processus consommaient inutilement de la mémoire vive et saturaient les ports TCP libres de la machine hôte.
Pour y remédier, nous avons conçu un mécanisme autonome d'auto-destruction basé sur une boucle de communication active (heartbeat) entre le navigateur client et le serveur FastAPI. Si aucune communication n'est enregistrée pendant 15 secondes, le serveur s'arrête proprement de lui-même.

## 2. Fichiers Concernés
- `dvc_viewer/server.py`
- `dvc_viewer/static/index.html`
- `README.md`
- `docs/index_tasks.md`

## 3. Objectifs (Definition of Done)
* **Serveur Autonome** : Le serveur dispose d'un processus interne d'évaluation de l'inactivité et se coupe proprement en cas d'absence prolongée de requêtes de vie du client.
* **Client Émetteur** : L'interface web envoie des signaux réguliers à intervalle fixe au serveur pour signaler sa présence active.
* **Résilience au Démarrage** : Un délai de grâce de 30 secondes au démarrage du serveur est garanti pour laisser le temps à l'interface client de charger et d'initier la boucle de ping.

# Postgres joignable depuis l'extérieur

Un PostgreSQL 16 vide, prêt à recevoir une synchronisation, à lancer sur une
machine que **tu** contrôles (ton PC, un VPS, un serveur). Il ne peut pas être
hébergé dans l'environnement d'exécution de l'assistant, qui est isolé et
éphémère.

## Démarrer

```bash
cp .env.example .env
# édite .env et mets un vrai mot de passe
docker compose up -d
```

Vérifier que c'est prêt :

```bash
docker compose ps
docker compose logs -f postgres   # Ctrl-C pour quitter
```

## URL de connexion

```
postgresql://grist:<mot_de_passe>@<ip_ou_dns_du_serveur>:5432/gristdb
```

- En local : `<ip_ou_dns_du_serveur>` = `localhost`
- Depuis l'extérieur : l'IP publique (ou le DNS) de la machine.

## Rendre le port réellement accessible

Lancer le conteneur ne suffit pas ; il faut aussi que le réseau laisse passer :

1. **Pare-feu de la machine** : ouvrir le port 5432.
   - `ufw` : `sudo ufw allow 5432/tcp`
   - `firewalld` : `sudo firewall-cmd --add-port=5432/tcp --permanent && sudo firewall-cmd --reload`
2. **Cloud / VPS** : ouvrir 5432 dans le *security group* / les règles réseau du fournisseur.
3. **Derrière une box / NAT maison** : faire une redirection de port 5432 vers la machine.

## ⚠️ Sécurité — à lire

Exposer Postgres directement sur Internet est risqué. Au minimum :

- mot de passe **fort** (pas celui de l'exemple) ;
- restreindre les IP autorisées (pare-feu / security group) au lieu de `0.0.0.0/0` ;
- idéalement, **ne pas** exposer le port et passer par un **tunnel SSH** :

  ```bash
  # côté client, tunnel vers un serveur qui garde Postgres en 127.0.0.1
  ssh -L 5432:localhost:5432 user@serveur
  # puis se connecter à localhost:5432
  ```

  Dans ce cas, mets `POSTGRES_BIND=127.0.0.1` dans `.env`.

## Arrêter / réinitialiser

```bash
docker compose down            # arrête, garde les données
docker compose down -v         # arrête ET supprime les données (base vide au prochain up)
```

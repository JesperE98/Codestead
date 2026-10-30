# Résumé : Réseau

Dans cette partie, vous vous êtes repéré dans un petit réseau domestique
depuis le terminal : votre propre adresse, la sortie vers Internet, les noms
et le DNS, les ports, le web et d'autres ordinateurs via SSH.

## Réseau

Chaque ordinateur d'un réseau a une **adresse IP**, et les adresses qui
commencent par `192.168.`, `10.` ou `172.16.`–`172.31.` sont **privées**.
`ip a` montre les interfaces et les adresses de l'ordinateur – `lo` est la
carte de bouclage, et `127.0.0.1` (**localhost**) désigne toujours
l'ordinateur lui-même. Le **masque de réseau** (`/24`) indique quelles
adresses sont sur le réseau local ; tout le reste passe par la route par
défaut vers la **passerelle**, que montre `ip route`. `ping` teste si un
ordinateur est joignable.

Le **DNS** traduit les noms en adresses. Avant de demander au DNS,
l'ordinateur regarde dans `/etc/hosts`, et `getent hosts` montre ce que le
système résout, tandis que `dig` interroge directement le DNS. Sur Ubuntu,
`/etc/resolv.conf` pointe vers `127.0.0.53`, systemd-resolved, et `dig`,
`host` et `nslookup` se trouvent dans le paquet `dnsutils`.

Un **port** désigne un programme sur un ordinateur, et `ss -tulpn` montre
quels ports sont en écoute. `curl` récupère une URL et l'affiche, `wget`
télécharge dans un fichier – sur Ubuntu, `wget` est préinstallé et `curl`
s'installe avec apt. Avec **SSH**, vous lancez des commandes sur un autre
ordinateur, de façon chiffrée ; la première fois, vous confirmez la clé
d'hôte du serveur, et avec une paire de clés, vous n'avez plus besoin de mot
de passe.

Quand « Internet ne marche pas », procédez de l'intérieur vers l'extérieur :
adresse, route, routeur, une adresse sur Internet et enfin un nom. Si les
adresses fonctionnent mais pas les noms, c'est le DNS.

## Commandes

| Commande | Fait |
|---|---|
| `ip a`, `ip -br a`, `hostname -I` | Afficher les adresses IP |
| `ip route` | Afficher la table de routage et la passerelle |
| `ping -c 3 HOST` | Tester si un ordinateur est joignable |
| `sudo ip link set CARD down` / `up` | Désactiver / activer une carte réseau |
| `cat /etc/resolv.conf` | Quel serveur DNS est interrogé |
| `dig +short NAME`, `dig @SERVER NAME` | Rechercher un nom dans le DNS |
| `host NAME`, `nslookup NAME` | Rechercher un nom (et aussi d'une adresse vers un nom avec `host`) |
| `getent hosts NAME` | Rechercher comme le fait le système (avec `/etc/hosts`) |
| `sudo tee -a /etc/hosts` | Ajouter ce qui vient d'un pipe à `/etc/hosts`, en root |
| `ss -tulpn` | Afficher les ports en écoute |
| `curl URL` | Récupérer et afficher |
| `curl -I URL`, `curl -L URL` | Seulement les en-têtes, suivre les redirections |
| `curl -o FILE URL`, `wget URL`, `wget -O FILE URL` | Télécharger dans un fichier |
| `ssh USER@HOST COMMAND` | Lancer une commande sur un autre ordinateur |
| `ssh-keygen`, `ssh-copy-id USER@HOST` | Créer une paire de clés et mettre la clé publique sur le serveur |

# Resumo: Redes

Nesta parte você se orientou em uma pequena rede doméstica pelo terminal: o
seu próprio endereço, o caminho para a internet, nomes e DNS, portas, a web e
outros computadores via SSH.

## Redes

Todo computador em uma rede tem um **endereço IP**, e os endereços que
começam com `192.168.`, `10.` ou `172.16.`–`172.31.` são **privados**. O
`ip a` mostra as interfaces e os endereços do computador – `lo` é a placa de
loopback, e `127.0.0.1` (**localhost**) sempre significa o próprio
computador. A **máscara de rede** (`/24`) diz quais endereços estão na rede
local; todo o resto vai pela rota padrão até o **gateway**, que o `ip route`
mostra. O `ping` testa se um computador pode ser alcançado.

O **DNS** traduz nomes em endereços. Antes de perguntar ao DNS, o computador
olha em `/etc/hosts`, e o `getent hosts` mostra o que o sistema resolve,
enquanto o `dig` pergunta diretamente ao DNS. No Ubuntu, o
`/etc/resolv.conf` aponta para `127.0.0.53`, o systemd-resolved, e o `dig`,
o `host` e o `nslookup` vêm no pacote `dnsutils`.

Uma **porta** indica um programa em um computador, e o `ss -tulpn` mostra
quais portas estão escutando. O `curl` busca uma URL e a imprime, o `wget`
baixa para um arquivo – no Ubuntu o `wget` vem pré-instalado e o `curl` é
instalado com o apt. Com o **SSH** você executa comandos em outro computador,
de forma criptografada; na primeira vez, você confirma a chave do host do
servidor, e com um par de chaves você não precisa mais de senha.

No `~/.ssh/config` você dá nomes curtos aos servidores com `Host`, `HostName`
e `User`. O `scp` copia como o `cp`, mas um dos lados é escrito `HOST:PATH`,
relativo ao diretório pessoal de lá. O `rsync -av` só copia o que mudou; uma
barra no final da origem significa "o que há dentro do diretório", e o
`--delete` faz do destino uma cópia exata – teste primeiro com `-n`.

Quando "a internet não funciona", vá de dentro para fora: endereço, rota,
roteador, um endereço na internet e, por fim, um nome. Se os endereços
funcionam, mas os nomes não, é o DNS.

## Comandos

| Comando | O que faz |
|---|---|
| `ip a`, `ip -br a`, `hostname -I` | Mostra os endereços IP |
| `ip route` | Mostra a tabela de rotas e o gateway |
| `ping -c 3 HOST` | Testa se um computador pode ser alcançado |
| `sudo ip link set CARD down` / `up` | Desliga / liga uma placa de rede |
| `cat /etc/resolv.conf` | Qual servidor DNS é consultado |
| `dig +short NAME`, `dig @SERVER NAME` | Consulta um nome no DNS |
| `host NAME`, `nslookup NAME` | Consulta um nome (com o `host`, também de endereço para nome) |
| `getent hosts NAME` | Consulta como o sistema faz (com o `/etc/hosts`) |
| `sudo tee -a /etc/hosts` | Acrescenta ao `/etc/hosts`, como root, o que vem de um pipe |
| `ss -tulpn` | Mostra as portas que estão escutando |
| `curl URL` | Busca e mostra |
| `curl -I URL`, `curl -L URL` | Só os cabeçalhos, seguir redirecionamentos |
| `curl -o FILE URL`, `wget URL`, `wget -O FILE URL` | Baixa para um arquivo |
| `ssh USER@HOST COMMAND` | Executa um comando em outro computador |
| `ssh-keygen`, `ssh-copy-id USER@HOST` | Cria um par de chaves e coloca a chave pública no servidor |
| `ssh srv` com `Host srv` no `~/.ssh/config` | Faz login com um nome curto |
| `scp FILE HOST:` · `scp HOST:FILE .` · `scp -r` | Copia para · de outro computador · diretórios inteiros |
| `rsync -av SOURCE/ TARGET` | Copia só o que mudou |
| `rsync -avn --delete SOURCE/ TARGET` | Testa um espelho sem fazer nada |
